import currencyFreaksService from "./api/currency-freaks/services/currency-freaks";

export default {
    /**
     * An asynchronous register function that runs before
     * your application is initialized.
     *
     * This gives you an opportunity to extend code.
     */
    register(/*{ strapi }*/) {},

    /**
     * An asynchronous bootstrap function that runs before
     * your application gets started.
     *
     * This gives you an opportunity to set up your data model,
     * run jobs, or perform some special logic.
     */
    async bootstrap({ strapi }) {
        currencyFreaksService({ strapi });
        strapi.db.lifecycles.subscribe({
            models: ["plugin::upload.file"],
            afterUpdate(event) {
                console.log("change metadata");
            },
        });
    },
};
