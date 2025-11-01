import { Request, Response } from "express";
import HelpTopic, { HELP_TOPIC_TYPE, IHelpTopic } from "../../../models/help/helpTopic";
import HelpTab from "../../../models/help/helpTabs";
import { generateUniqueSlug } from "./helper/help.helper";
import { ApiError } from "../../../utils/error-handlers/ApiError";
import { validateObjectId, withMongoTransaction } from "../../../utils/mongo-helper/mongo.utils";
import { ApiResponse } from "../../../utils/error-handlers/ApiResponse";
import { MongoObjectId } from "../../../types/mongo/mongo";
import HelpArticle from "../../../models/help/helpArticle";
import { releaseUploadResources } from "../../../../uploads/services/upload.service";

export const createTopic = async (req: Request, res: Response) => {
    const { title, type, isRootTopic, parentId, audience } = req.body;


    if (isRootTopic == undefined) {
        throw new ApiError(400, 'isRootTopic flag is required')
    }
    if (type != 'topic') {
        if (!parentId) {
            throw new ApiError(400, 'parent id is required for child topic')
        }

    }

    if (type == 'topic' && !audience) {
        throw new ApiError(400, 'audience is required when topic is a root')
    }

    if (!title) return res.status(400).json({ message: "Title is required" });
    // throw new ApiError(409, 'forced')
    const slug = await generateUniqueSlug(title, type);

    const payload = {
        ...req.body, parentId, slug,
    }

    if (!isRootTopic) {
        if (!parentId) {
            throw new ApiError(400, 'parent id is missing when topic is root')
        }
        const parentTopic = await HelpTopic.findOne({ _id: parentId }).select('rootId parentId type audience')
        const parentAudience = parentTopic.audience[0]
        if (!parentTopic) {
            throw new ApiError(409, 'No root id found not allowed')
        }

        let rootId = parentTopic.rootId as any
        payload.parentId = parentId
        payload.audience = [parentAudience]
        if (parentTopic.type == 'topic') {
            rootId = parentTopic._id
        }

        payload.rootId = rootId
    }

    const topic = new HelpTopic(payload);
    await topic.save();

    res.status(201).json(topic);

};

export const updateTopic = async (req: Request, res: Response) => {
    const { isRootTopic, parentId, rootId } = req.body;

    if (parentId == req.params.id) {
        throw new ApiError(400, 'parent id and topic id can not be same')
    }

    const topicId = validateObjectId(req.params.id)

    const currentTopic = await HelpTopic.findById(topicId)
    if (!currentTopic) return res.status(404).json({ message: "Topic not found" });

    if (currentTopic.type != 'topic') {
        const parentId = validateObjectId(req.body.parentId)
        const parentTopic = await HelpTopic.findById(parentId)
        if (!parentTopic) {
            throw new ApiError(409, 'No parent found to update current topic.')
        }
    }
    const payload = req.body

    await HelpTopic.updateOne({ _id: topicId }, { $set: payload })

    return res.json(new ApiResponse(200, 'Topic updated successfully'))

};

export const getTopicById = async (req: Request, res: Response) => {
    const topic = await HelpTopic.findById(req.params.id,)
        .populate('audience', 'tabName')
        .lean()

    if (!topic) return res.status(404).json({ message: "Topic not found" });


    res.json({ data: topic });
};

export const deleteTopic = async (req: Request, res: Response) => {
    const topicId = validateObjectId(req.params.id);

    const [topicAgg] = await HelpTopic.aggregate<{
        _id: MongoObjectId,
        directArticle?: { _id: MongoObjectId, type?: string, image?: string },
        topics: (IHelpTopic & { article?: { _id: MongoObjectId, type?: string, image?: string } })[]
    }>([
        { $match: { _id: topicId } },

        {
            $lookup: {
                from: "helparticles",
                localField: "articleId",
                foreignField: "_id",
                as: "directArticle"
            }
        },
        {
            $unwind: {
                path: "$directArticle",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $graphLookup: {
                from: "helptopics",
                startWith: "$_id",
                connectFromField: "_id",
                connectToField: "parentId",
                as: "topics"
            }
        },

        {
            $unwind: {
                path: "$topics",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: "helparticles",
                let: { aid: "$topics.articleId" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$_id", "$$aid"] } } },
                    { $project: { _id: 1, type: 1, image: 1 } }
                ],
                as: "topics.article"
            }
        },
        {
            $addFields: {
                "topics.article": { $arrayElemAt: ["$topics.article", 0] }
            }
        },

        {
            $group: {
                _id: "$_id",
                directArticle: { $first: "$directArticle" },
                topics: { $push: { $cond: [{ $gt: [{ $ifNull: ["$topics._id", null] }, null] }, "$topics", "$$REMOVE"] } }
            }
        }
    ]);


    const connectedTopics = topicAgg?.topics
    const directArticle = topicAgg?.directArticle

    await withMongoTransaction(async (session) => {
        if (directArticle) {
            releaseUploadResources(directArticle?.image)
            await HelpArticle.deleteOne({ _id: directArticle._id }).session(session)
        }
        //-> will refactor later
        connectedTopics.forEach(async (topic) => {

            const topicId = topic._id
            const articleTopic = topic?.article

            if (articleTopic) {
                const articleId = articleTopic?._id
                const articleImage = articleTopic?.image
                if (articleImage) {

                    releaseUploadResources(articleImage)
                }
                await HelpArticle.deleteOne({ _id: articleId }).session(session)
            }
            await HelpTopic.deleteOne({ _id: topicId }).session(session)
        })

        //deleting target main topic.
        await HelpTopic.deleteOne({ _id: topicId }).session(session)
    })

    return res.json({ message: 'Topic deleted successfully.' });
};




export const getActiveTopics = async (req: Request, res: Response) => {
    let {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        search,
        audience,
        isActive = "true",
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    const matchStage: any = {};

    if (isActive !== "all") {
        matchStage.isActive = isActive === "true";
    }

    if (audience) {
        matchStage.audience = audience as string;
    }

    const sortStage: any = { [String(sortBy)]: sortOrder === "asc" ? 1 : -1 };
    const skip = (page - 1) * limit;

    const pipeline: any[] = [
        { $match: matchStage },

        {
            $lookup: {
                from: "helptabs",
                localField: "audience",
                foreignField: "_id",
                as: "audience",
            },
        },
    ];

    if (search) {
        pipeline.push({
            $match: {
                $or: [
                    { title: { $regex: search as string, $options: "i" } },
                    { "audience.tabName": { $regex: search as string, $options: "i" } },
                    { type: { $regex: search as string, $options: "i" } },
                ],
            },
        });
    }

    pipeline.push(
        { $sort: sortStage },
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit },
                ],
                total: [{ $count: "count" }],
            },
        },
        {
            $addFields: {
                total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
            },
        }
    );

    const result = await HelpTopic.aggregate(pipeline);
    const topics = result[0]?.data || [];
    const total = result[0]?.total || 0;

    const helpTabs = await HelpTab.find({ isVisible: true })
        .select("tabName")
        .lean();

    res.json({
        data: topics,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        availableOptions: {
            audience: helpTabs,
            type: Object.values(HELP_TOPIC_TYPE),
        },
    });
};

export async function getTopicFormOptions(req: Request, res: Response) {
    console.log("hit");

    const helpTabs = await HelpTab.find({ isVisible: true })
        .select("tabName")
        .lean();

    const options = {
        audience: helpTabs,
        type: Object.values(HELP_TOPIC_TYPE),
    }
    return res.json(options)


}