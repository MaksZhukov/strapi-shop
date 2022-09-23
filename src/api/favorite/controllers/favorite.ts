/**
 *  favorite controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
    "api::favorite.favorite",
    //@ts-ignore
    ({ strapi }) => ({
        async find(ctx) {
            const userId = ctx.state.user.id;
            ctx.query = {
                ...ctx.query,
                populate: "product.product.images",
                filters: {
                    usersPermissionsUser: userId,
                },
            };
            const result = await super.find(ctx);

            return {
                data: result.data.map((item) => {
                    return {
                        ...item,
                        attributes: {
                            ...item.attributes,
                            product: item.attributes.product[0].product.data,
                        },
                    };
                }),
            };
        },
        async create(ctx) {
            const userId = ctx.state.user.id;
            ctx.query = { populate: ["product.product.images"] };
            ctx.request.body.data.usersPermissionsUser = userId;
            const result = await super.create(ctx);
            return {
                data: {
                    ...result.data,
                    attributes: {
                        ...result.data.attributes,
                        product: result.data.attributes.product[0].product.data,
                    },
                },
            };
        },
        async delete(ctx) {
            const { id } = ctx.params;
            const userId = ctx.state.user.id;
            if (
                await strapi.db.query("api::favorite.favorite").findOne({
                    where: {
                        id,
                        usersPermissionsUser: userId,
                    },
                })
            ) {
                return super.delete(ctx);
            }
        },
    })
);
