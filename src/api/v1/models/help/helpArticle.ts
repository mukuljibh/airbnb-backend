import { Schema, model, Types } from 'mongoose';

const HelpArticleSchema = new Schema({
    topicId: { type: Types.ObjectId, ref: 'HelpTopic', required: true },
    image: { type: String },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    content: { type: String, required: true },
    summary: { type: String, trim: true },
    type: { type: String, default: 'how-to' },  // e.g., "how-to"
    // audience: { type: String, default: 'guest' },  // e.g., "guest", "host"
    audience: { type: Types.ObjectId, ref: 'HelpTab', required: true },  // e.g., "guest", "host"
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    views: { type: Number, default: 0 },
    tags: [{ type: String }],
    metaTitle: String,
    metaDescription: String,
}, { timestamps: true });


// HelpArticleSchema.index({ title: "text", metaTitle: "text" });
HelpArticleSchema.index({
    title: "text",
    metaTitle: "text",
    summary: "text",
    content: "text",
    tags: "text",
});

const HelpArticle = model('HelpArticle', HelpArticleSchema);

export default HelpArticle;

