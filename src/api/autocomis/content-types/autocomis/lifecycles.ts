import { lifecycleSitemap, revalidateClientPage } from "../../../../lifecycles";

export default {
    afterUpdate() {
        revalidateClientPage("/autocomises");
        lifecycleSitemap();
    },
    afterCreate: lifecycleSitemap,
    afterDelete: lifecycleSitemap,
};
