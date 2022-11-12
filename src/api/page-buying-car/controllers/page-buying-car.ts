/**
 * page-buying-car controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
    "api::page-buying-car.page-buying-car",
    () => ({
        find(ctx) {
            ctx.query.populate = "seo.images";
            return super.find(ctx);
        },
    })
);
