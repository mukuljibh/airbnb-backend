import HelpArticle from "../../../../models/help/helpArticle";
import HelpTopic from "../../../../models/help/helpTopic";

import { HELP_TOPIC_TYPE } from "../../../../models/help/helpTopic";
import { ExtractValue } from "../../../../types/generics/generic";



export const generateUniqueSlug = async (
    title: string,
    type: ExtractValue<typeof HELP_TOPIC_TYPE>
) => {

    let baseSlug = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

    baseSlug = `${type}-${baseSlug}`;

    baseSlug = baseSlug.replace(/-\d+$/, "");

    let slug = baseSlug;
    let count = 1;

    while (await HelpTopic.findOne({ slug })) {
        slug = `${baseSlug}-${count}`;
        count++;
    }

    return slug;
};

export const generateUniqueSlugForArticle = async (
    title: string,
    type: ExtractValue<typeof HELP_TOPIC_TYPE>
) => {

    let baseSlug = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

    baseSlug = `${type}-${baseSlug}`;

    baseSlug = baseSlug.replace(/-\d+$/, "");

    let slug = baseSlug;
    let count = 1;

    while (await HelpArticle.findOne({ slug })) {
        slug = `${baseSlug}-${count}`;
        count++;
    }

    return slug;
};


export function generateTabValue(tabName: string) {

    return tabName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}