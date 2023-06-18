import axios from "axios";
import { convertArrayToCSV } from "convert-array-to-csv";
import { Agent } from "https";
import { productTypeUrlSlug } from "../config";
import { ALTS_ARR } from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export const hasDelayOfSendingNewProductsEmail = async (strapi) => {
    const { dateNewProductSentToEmail } = await strapi
        .service("plugin::internal.data")
        .find();
    return (
        new Date(dateNewProductSentToEmail).getTime() <
        new Date().getTime() - DAY_MS
    );
};

export const getProductUrl = (item) => {
    let clientUrl = strapi.config.get("server.clientUrl");
    return (
        clientUrl +
        `/${productTypeUrlSlug[item.type]}/${item.brand?.slug}/` +
        item.slug
    );
};

export const getProductsUrls = async (strapi) => {
    let queries = [
        strapi.db.query("api::spare-part.spare-part"),
        strapi.db.query("api::cabin.cabin"),
        strapi.db.query("api::wheel.wheel"),
        strapi.db.query("api::tire.tire"),
    ];

    const urls = [];

    await runProductsQueriesWithLimit(queries, 10000, (products: any[]) => {
        urls.push(...products.map((item) => getProductUrl(item)));
    });
    return urls;
};

export const sendNewProductsToEmail = async ({ strapi }) => {
    try {
        const urls = await getProductsUrls(strapi);

        let str = urls.reduce((prev, curr) => prev + curr + "\n", "");
        await strapi.plugins.email.services.email.send({
            to: [
                strapi.config.get("server.emailForNewProducts"),
                "maks_zhukov_97@mail.ru",
            ],
            from: strapi.plugins.email.config("providerOptions.username"),
            subject: "Ссылки на все товары",
            attachments: [
                {
                    filename: "products.txt",
                    content: str,
                },
            ],
        });

        await strapi.service("plugin::internal.data").createOrUpdate({
            data: {
                dateNewProductSentToEmail: new Date().getTime(),
            },
        });
    } catch (err) {
        console.error(err);
    }
};

export const updateCurrency = async ({ strapi }) => {
    let key = strapi.config.get("server.currency-freaks-key");
    try {
        const {
            data: {
                rates: { BYN },
            },
        } = await axios.get(
            `https://api.currencyfreaks.com/latest?apikey=${key}&symbols=BYN`,
            { httpsAgent: new Agent({ rejectUnauthorized: false }) }
        );
        await strapi.service("plugin::internal.data").createOrUpdate({
            data: {
                currencyDate: new Date().getTime(),
                currencyCoefficient: 1 / BYN,
            },
        });
    } catch (err) {
        console.log(err);
    }
};

const getCategory = (item) => ({
    cabin: `салон ${item.brand?.name} ${item.model?.name}`,
    tire: `шины ${item.brand?.name}`,
    wheel: `диски ${item.brand?.name}`,
    sparePart: `запчасть ${item.brand?.name} ${item.model?.name}`,
});

export const hasDelayOfSendingProductsInCsvEmail = async (strapi) => {
    const { dateProductsInCsvSentToEmail } = await strapi
        .service("plugin::internal.data")
        .find();
    return (
        new Date(dateProductsInCsvSentToEmail).getTime() <
        new Date().getTime() - DAY_MS
    );
};

const getDataForCsv = (items, serverUrl) =>
    items.map((item) => [
        getCategory(item)[item.type],
        item.h1,
        item.id,
        item.description,
        item.price,
        item.images ? serverUrl + item.images[0].url : "",
    ]);

export const sendProductsInCSVToEmail = async ({ strapi }) => {
    const serverUrl = strapi.config.get("server.serverUrl");
    const header = [
        "Категория",
        "Название",
        "Идентификатор",
        "Описание",
        "Цена",
        "Фото",
    ];
    const [spareParts, cabins, wheels, tires] = await Promise.all([
        strapi.db
            .query("api::spare-part.spare-part")
            .findMany({ populate: { images: true, brand: true, model: true } }),
        strapi.db
            .query("api::cabin.cabin")
            .findMany({ populate: { images: true, brand: true, model: true } }),
        strapi.db
            .query("api::wheel.wheel")
            .findMany({ populate: { images: true, brand: true } }),
        strapi.db
            .query("api::tire.tire")
            .findMany({ populate: { images: true, brand: true } }),
    ]);

    let data = [
        ...getDataForCsv(spareParts, serverUrl),
        ...getDataForCsv(cabins, serverUrl),
        ...getDataForCsv(wheels, serverUrl),
        ...getDataForCsv(tires, serverUrl),
    ];

    const csv: string = convertArrayToCSV(data, { header });

    await strapi.plugins.email.services.email.send({
        to: [
            strapi.config.get("server.emailForNewProducts"),
            "maks_zhukov_97@mail.ru",
        ],
        from: strapi.plugins.email.config("providerOptions.username"),
        subject: "Все Товары",
        attachments: [
            {
                filename: "products.csv",
                content: "\ufeff" + csv,
            },
        ],
    });

    await strapi.service("plugin::internal.data").createOrUpdate({
        data: {
            dateProductsInCsvSentToEmail: new Date().getTime(),
        },
    });
};

export const getCountUnrelatedMedia = async () => {
    let count = 0;
    const medias = await strapi.plugins["upload"].services.upload.findMany({
        populate: "*",
    });
    medias.forEach((media) => {
        if (!media.related.length) {
            count++;
        }
    });
    return count;
};

export const deleteUnrelatedMediaForApiUploadFolder = async () => {
    const medias = await strapi.plugins["upload"].services.upload.findMany({
        populate: "*",
    });

    medias
        .filter((item) => !item.related.length && item.folder?.id === 1)
        .forEach((item) => {
            strapi.plugins["upload"].services.upload.remove(item);
        });
};

export const removeImagesByApiUID = async (apiUID) => {
    const spareParts = await strapi.db.query(apiUID).findMany({
        populate: ["images"],
    });
    const images = spareParts.map((item) => item.images).flat();
    images.forEach((item) => {
        strapi.plugins["upload"].services.upload.remove(item);
    });
};

export const generateDefaultBrandTextComponent = (item, type, slug) => {
    let clientUrl = strapi.config.get("server.clientUrl");
    return {
        content: `<p>
        Если у вас не получилось найти именно то, что бы вы хотели, позвоните нам и мы поможем вам выбрать, <a href="${clientUrl}/${slug}/${item.slug}">купить <span> ${type} для ${item.name}</span></a>, те именно то, что необходимо вам 
</p>`,
    };
};

export const generateDefaultBrandSnippets = (type: string, name: string) => ({
    title: `Купить ${type} для ${name}. Доставка. Цены не кусаются`,
    description: `Предлагаем купить ${type} для ${name} в нашем магазине. Диски, салоны, запчасти. На нашей разборке найдется все для вашего авто`,
    keywords: `${type.charAt(0).toUpperCase() + type.slice(1)} для ${name}`,
    h1: `${type.charAt(0).toUpperCase() + type.slice(1)} для ${name}`,
});

export const generateDefaultTireBrandSnippets = (name: string) => ({
    title: `Купить шины ${name}. Доставка. Цены не кусаются`,
    description: `Предлагаем купить шины ${name} в нашем магазине. На нашей разборке найдется все для вашего авто`,
    keywords: "Шины " + name,
    h1: "Шины " + name,
});

export const generateDefaultModelSnippets = (
    type: string,
    brandName: string,
    modelName: string
) => ({
    title: `${
        type.charAt(0).toUpperCase() + type.slice(1)
    } для ${brandName} ${modelName} б/у купить с доставкой по Беларуси`,
    description: `Ищете как можно ${type} для ${brandName} ${modelName} б/у купить выгодно? У нас топ цены, доставка, покупка онлайн на сайте. Огромный выбор`,
    keywords: `${
        type.charAt(0).toUpperCase() + type.slice(1)
    } для ${brandName} ${modelName}`,
    h1: `${
        type.charAt(0).toUpperCase() + type.slice(1)
    } для ${brandName} ${modelName}`,
});

export const updateAltTextForProductImages = (data, images) => {
    images?.forEach((image, index) => {
        let values = {
            h1: data.h1,
            title: data.seo?.title,
            description: data.seo?.description,
        };
        let alt = values[ALTS_ARR[index]] || data.h1 + " " + ALTS_ARR[index];
        strapi.plugins.upload.services.upload.updateFileInfo(image.id, {
            alternativeText: alt,
            caption: alt,
        });
    });
};

export const getStringByTemplateStr = (value: string, data: any) => {
    if (!value) {
        return "";
    }
    let newValue = value;
    for (let result of value.matchAll(/{(\w+)}/g)) {
        let field = result[1];
        newValue = newValue.replace(
            result[0],
            typeof data[field] === "string" ? data[field] : data[field]?.name
        );
    }
    return newValue;
};

export const getProductPageSeo = (pageSeo: any, product: any) => {
    return {
        title:
            product.seo?.title ||
            getStringByTemplateStr(pageSeo.title, product),
        description:
            product.seo?.description ||
            getStringByTemplateStr(pageSeo.description, product),
        keywords:
            product.seo?.keywords ||
            getStringByTemplateStr(pageSeo.keywords, product),
    };
};

export const scheduleUpdateAltTextForProductImages = (
    data,
    apiUID,
    pageProductApiUID
) => {
    console.log(pageProductApiUID);
    setTimeout(async () => {
        const [entity, pageProduct] = await Promise.all([
            strapi.service(apiUID).findOne(data.id, {
                populate: { images: true, seo: true },
            }),
            strapi.service(pageProductApiUID).find({ populate: { seo: true } }),
        ]);
        //@ts-expect-error error
        entity.seo = getProductPageSeo(pageProduct.seo, entity);
        updateAltTextForProductImages(entity, entity.images);
    }, 1000);
};

export const getProductH1 = async (data, isTire: boolean) => {
    let h1 = data.name;
    if (data.brand) {
        const brand = await strapi.entityService.findOne(
            isTire ? "api::tire-brand.tire-brand" : "api::brand.brand",
            data.brand
        );
        h1 += " " + (brand?.name || "");
        if (data.model) {
            const model = await strapi.entityService.findOne(
                "api::model.model",
                data.model
            );
            h1 += " " + model?.name || "";
            data.h1 = h1;
        }
    }
    return h1;
};

export const sendNotificationOnStart = async () =>
    strapi.plugins.email.services.email.send({
        to: "maks_zhukov_97@mail.ru",
        from: strapi.plugins.email.config("providerOptions.username"),
        subject: "Start Strapi BE Successful",
    });

export const removeFavoritesOnSold = async (data, component) => {
    if (data.result.sold) {
        const favorites = await strapi.db
            .query("api::favorite.favorite")
            .findMany({
                where: {
                    uid: { $endsWith: `-${data.result.id}-${component}` },
                },
            });
        await strapi.db.query("api::favorite.favorite").deleteMany({
            where: {
                id: favorites.map((item) => item.id),
            },
        });
    }
};

export const runProductsQueriesWithLimit = async (
    queries,
    limit,
    callback,
    timeout = 100
) => {
    let index = 0;
    let page = 0;
    let products = [];
    while (index < queries.length) {
        let query = queries[index];
        const results = await query.findMany({
            populate: ["brand", "images"],
            limit: limit - products.length,
            offset: page * limit,
        });
        products.push(...results);
        if (products.length === limit || index === queries.length - 1) {
            await new Promise((res) => {
                setTimeout(() => {
                    res(callback(products));
                }, timeout);
            });
            page++;
            products = [];
        }
        if (results.length < limit) {
            index++;
            page = 0;
        }
    }
};

export const addProductUrlToTelegramAllProductsJobUrls = async (
    id: string,
    uid: string
) => {
    const product = await strapi.db
        .query(uid)
        .findOne({ where: { id }, populate: ["brand"] });
    const productUrl = getProductUrl(product);
    const job = await strapi.db
        .query("plugin::telegram.jobs")
        .findOne({ where: { allProducts: true } });
    if (job) {
        await strapi.db
            .query("plugin::telegram.urls")
            .create({ data: { url: productUrl, job: job.id } });
    }
};
