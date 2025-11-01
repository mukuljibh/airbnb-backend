import { Schema, model, Types, Document } from 'mongoose';
import { ExtractValue } from '../../types/generics/generic';


export const HELP_TOPIC_AUDIENCE = {
    GUEST: 'guest',
    HOME_HOST: 'home-host',
    SERVICE_HOST: 'service-host',
    EXPERIENCE_HOST: 'experience-host',
} as const



export const HELP_TOPIC_TYPE = {
    TOPIC: 'topic',
    SUB_CATEGORY: 'subcategory',
    ARTICLE: 'article',
    INNER_TOPIC: 'innertopic',
} as const

export interface IHelpTopic extends Document {
    rootId?: Types.ObjectId | null;
    parentId?: Types.ObjectId | null;
    articleId?: Types.ObjectId | null;
    audience: Types.ObjectId[];
    title: string;
    description?: string;
    slug: string;
    tags?: string[];
    order: number;
    type: ExtractValue<typeof HELP_TOPIC_TYPE>;
    isActive: boolean;
}
const HelpTopicSchema = new Schema<IHelpTopic>(
    {
        rootId: { type: Schema.Types.ObjectId, ref: 'HelpTopic', default: null },
        parentId: { type: Schema.Types.ObjectId, ref: 'HelpTopic', default: null },
        articleId: { type: Schema.Types.ObjectId, ref: 'HelpArticle', default: null },
        audience: { type: [Schema.Types.ObjectId], ref: 'HelpTab', required: true },
        title: { type: String, required: true },
        description: { type: String },
        slug: { type: String, required: true, unique: true },

        tags: [String],
        order: { type: Number, default: 0 },
        type: {
            type: String,
            enum: Object.values(HELP_TOPIC_TYPE),
            default: 'topic'
        },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

const HelpTopic = model<IHelpTopic>('HelpTopic', HelpTopicSchema);

export default HelpTopic;
