import { Request, Response } from "express";
import HelpArticle from "../../../models/help/helpArticle";
import mongoose from "mongoose";
import HelpTopic from "../../../models/help/helpTopic";
import { confirmUploadResources, releaseUploadResources } from "../../../../uploads/services/upload.service";
import HelpTab from "../../../models/help/helpTabs";
import { validateObjectId } from "../../../utils/mongo-helper/mongo.utils";
import { generateUniqueSlugForArticle } from "./helper/help.helper";
import { ApiError } from "../../../utils/error-handlers/ApiError";
import { ApiResponse } from "../../../utils/error-handlers/ApiResponse";

// ---------------- CREATE ARTICLE ----------------
export const createArticle = async (req: Request, res: Response,) => {
    const articleData = req.body
    const { topicId, audience: clientAudience } = articleData

    // ✅ Validate topicId if provided
    if (!topicId) {
        return res.status(400).json({ message: "topicId is required" });
    }

    if (topicId && !mongoose.Types.ObjectId.isValid(topicId)) {
        return res.status(400).json({ message: "Invalid topicId" });
    }
    const existingArticle = await HelpArticle.findOne({ topicId })

    if (existingArticle) {
        throw new ApiError(400, 'Article already exists.')
    }
    const articleTopicContainer = await HelpTopic.findOne({ _id: topicId }).select('audience')

    if (!articleTopicContainer) {
        throw new ApiError(400, 'No help topic found with provide topic id')
    }
    // const existingAudience = articleTopicContainer.audience

    // if (!existingAudience.includes(clientAudience)) {
    //     throw new ApiError(400, `parent topic already belongs ${existingAudience[0]} can not change to ${clientAudience}`)
    // }

    const slug = await generateUniqueSlugForArticle(articleData.title, 'article')
    confirmUploadResources(articleData?.image)
    const article = new HelpArticle({ ...articleData, slug, audience: articleTopicContainer.audience[0] });

    confirmUploadResources(articleData?.image)

    await article.save();

    // ✅ If topicId provided, update HelpTopic
    if (topicId) {
        const topic = await HelpTopic.findById(topicId);
        if (!topic) {
            return res.status(404).json({ message: "Topic not found" });
        }
        // console.log({ topic });
        topic.articleId = article._id
        await topic.save();
    }

    res.status(201).json(article);

};

// ---------------- UPDATE ARTICLE ----------------next: NextFunction
export const updateArticle = async (req: Request, res: Response,) => {
    const { topicId, ...articleData } = req.body;
    const articleId = validateObjectId(req.params.id);

    const slug = await generateUniqueSlugForArticle(articleData.title, 'article')

    const parentTopic = await HelpTopic.findOne({ _id: topicId, type: 'article' })

    if (!parentTopic) {
        throw new ApiError(404, 'No parent article topic found')
    }

    const existingAudience = parentTopic.audience

    // const clientAudience = articleData?.audience
    // if (!existingAudience.includes(clientAudience)) {
    //     throw new ApiError(400, `parent topic already belongs ${existingAudience[0]} can not change to ${clientAudience}`)
    // }
    const article = await HelpArticle.findOne({ _id: articleId })

    if (!article) {
        throw new ApiError(404, 'Article not found')
    }
    await HelpArticle.findByIdAndUpdate(articleId, { $set: { ...articleData, audience: parentTopic?.audience[0], topicId, slug } });

    const oldTopicId = article.topicId
    //removing article if from old topic
    if (topicId != oldTopicId) {
        await HelpTopic.updateOne({ _id: article.topicId }, { $set: { articleId: null } })
    }

    // ✅ If new  topicId provided, update HelpTopic with article id
    if (topicId) {
        if (!mongoose.Types.ObjectId.isValid(topicId)) {
            return res.status(400).json({ message: "Invalid topicId" });
        }

        const topic = await HelpTopic.findById(topicId);
        if (!topic) {
            return res.status(404).json({ message: "Topic not found" });
        }

        topic.articleId = article._id;
        await topic.save();
    }

    res.json(article);

};

// ---------------- DELETE ARTICLE ----------------
export const deleteArticle = async (req: Request, res: Response) => {
    const articleId = validateObjectId(req.params.id);

    const article = await HelpArticle.findById(articleId);
    if (!article) {
        throw new ApiError(404, "Article not found")
    }

    await HelpTopic.updateMany(
        { articleId: article._id },
        { $unset: { articleId: "" } }
    );
    releaseUploadResources(article?.image)
    await article.deleteOne();
    return res.json(new ApiResponse(200, "Article deleted successfully"))

};

export const getArticleBySlug = async (
    req: Request,
    res: Response,

) => {
    const {
        slug,
        search,       // keyword for search
        audience,     // filter
        topicId,      // filter
        status,       // <- NEW (draft | published | all)
        sortBy = "createdAt",
        sortOrder = "desc",
        page = "1",
        limit = "10"
    } = req.query as Record<string, string>;

    const query: any = {};

    // ✅ Status filter
    if (status && status !== "all") {
        query.status = status; // "draft" or "published"
    } else {
        query.status = { $in: ["draft", "published"] }; // show all
    }

    // Slug filter (if given)
    if (slug) {
        query.slug = slug;
    }

    // Audience filter
    if (audience) {
        query.audience = audience;
    }

    // Topic filter
    if (topicId) {
        query.topicId = topicId;
    }

    // Search in title/content
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: "i" } },
            // { content: { $regex: search, $options: "i" } }
        ];
    }

    // Convert pagination params
    const skip = (Number(page) - 1) * Number(limit);

    // Sorting
    const sort: Record<string, 1 | -1> = {
        [sortBy]: sortOrder === "asc" ? 1 : -1
    };

    // Fetch articles
    const articles = await HelpArticle.find(query)
        .populate('topicId', 'title')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit));

    // Total count for pagination
    const total = await HelpArticle.countDocuments(query);

    const helpTabs = await HelpTab.find({ isVisible: true })
        .select('tabName')
        .lean()

    res.json({
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
        data: articles,
        availableOptions: {
            audience: helpTabs

        }
    });

};


export const getArticleById = async (req: Request, res: Response) => {
    const id = validateObjectId(req.params.id);

    const article = await HelpArticle.findById(id)
        .populate("topicId", "_id title slug")
        .lean();

    if (!article) {
        return res.status(404).json({ message: "Article not found" });
    }

    res.json({ data: article });

};