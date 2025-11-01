import { Request, Response } from "express";
import HelpTopic, { HELP_TOPIC_TYPE } from "../../../models/help/helpTopic";
import { validateObjectId } from "../../../utils/mongo-helper/mongo.utils";
import mongoose from "mongoose";
import HelpTab from "../../../models/help/helpTabs";

export const getActiveTopics = async (req: Request, res: Response) => {
    const topics = await HelpTopic.find({ isActive: true });
    res.json(topics);
};



export const getActiveTopicsInfiniteScroll = async (req: Request, res: Response) => {
    const { page = 1, limit = 10, search = "", id, rootId, currentTopicId, type } = req.query;

    const skip = (+page - 1) * +limit;

    const pipeline: any[] = [
        { $match: { isActive: true } },

        {
            $lookup: {
                from: "helptabs",
                localField: "audience",
                foreignField: "_id",
                as: "audience",
            },
        },

        { $unwind: { path: "$audience", preserveNullAndEmptyArrays: true } },
    ];

    if (search) {
        pipeline.push({
            $match: {
                $or: [
                    { title: { $regex: search as string, $options: "i" } },
                    { "audience.tabName": { $regex: search as string, $options: "i" } },
                ],
            },
        });
    }

    if (type) {
        pipeline.push({ $match: { type } });
        if (type === "article") {
            pipeline.push({ $match: { articleId: null } });
        }
    } else {
        pipeline.push({ $match: { type: { $ne: "article" } } });
    }

    if (rootId) {
        pipeline.push({ $match: { rootId: validateObjectId(rootId as string) } });
    }

    if (currentTopicId) {
        pipeline.push({ $match: { _id: { $ne: validateObjectId(currentTopicId as string) } } });
    }

    pipeline.push({
        $project: {
            _id: 1,
            title: 1,
            type: 1,
            rootId: 1,
            articleId: 1,
            createdAt: 1,
            "audience._id": 1,
            "audience.tabName": 1,
        },
    });

    pipeline.push({ $sort: { createdAt: 1 } });

    pipeline.push({
        $facet: {
            data: [
                { $skip: skip },
                { $limit: +limit },
            ],
            total: [{ $count: "count" }],
        },
    });

    pipeline.push({
        $addFields: {
            total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        },
    });

    let result = await HelpTopic.aggregate(pipeline);

    let topics = result[0]?.data || [];
    const total = result[0]?.total || 0;

    if (id && +page === 1) {
        const found = await HelpTopic.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(id as string), isActive: true } },
            {
                $lookup: {
                    from: "helptabs",
                    localField: "audience",
                    foreignField: "_id",
                    as: "audience",
                },
            },
            { $unwind: { path: "$audience", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    type: 1,
                    rootId: 1,
                    articleId: 1,
                    createdAt: 1,
                    "audience._id": 1,
                    "audience.tabName": 1,
                },
            },
        ]);

        if (found[0]) {
            topics = topics.filter(t => t._id.toString() !== id);
            topics.unshift(found[0]);
        }
    }

    const helpTabs = await HelpTab.find({ isVisible: true })
        .select("tabName")
        .lean();

    const options = {
        audience: helpTabs,
        type: Object.values(HELP_TOPIC_TYPE),
    }
    res.json({
        data: topics,
        page: +page,
        total,
        hasMore: +page * +limit < total,
        options
    });
};




export const getTopicBySlug = async (req: Request, res: Response) => {


    const rootTopic = await HelpTopic.aggregate([
        {
            $match: {
                type: 'topic',
                slug: { $ne: 'all-topics' },
                isActive: true
            }
        },
        {
            $lookup: {
                from: "helptabs",
                localField: "audience",
                foreignField: "_id",
                as: "audience"
            }
        },
        {
            $match: {
                'audience.isVisible': true
            }
        },
        {
            $lookup: {
                from: 'helptopics',
                localField: '_id',
                foreignField: 'parentId',
                pipeline: [
                    {
                        $match: {
                            isActive: true

                        }
                    },
                    {
                        $lookup: {
                            from: "helptabs",
                            localField: "audience",
                            foreignField: "_id",
                            as: "audience"
                        }
                    },
                ],
                as: 'innersubtopics'
            }
        }
    ])

    if (!rootTopic) {

        return res.status(404).json({ message: "Root topic not found" });
    }

    const tabs = await HelpTab.find({ isVisible: true })
        .select('tabName isVisible')
        .lean()

    return res.json({
        tabs,
        topic: null,
        breadcrumb: [],
        subtopics: rootTopic
    });

};




export const getTopicById = async (
    req: Request,
    res: Response,
) => {
    const topicId = validateObjectId(req.params.id);

    const result = await HelpTopic.aggregate([
        { $match: { _id: topicId, isActive: true } },

        // Breadcrumb
        {
            $graphLookup: {
                from: "helptopics",
                startWith: "$parentId",
                connectFromField: "parentId",
                connectToField: "_id",
                as: "breadcrumb",
                restrictSearchWithMatch: { isActive: true }
            }
        },

        // Subtopics (keeping your original structure)
        {
            $lookup: {
                from: 'helptopics',
                let: { topicId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ['$parentId', '$$topicId'] },
                            isActive: true
                        }
                    },
                    {
                        $lookup: {
                            from: 'helptopics',
                            let: { topicId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: { $eq: ['$parentId', '$$topicId'] },
                                        isActive: true
                                    }
                                },
                                {
                                    $lookup: {
                                        from: 'helptabs',
                                        localField: 'audience',
                                        foreignField: '_id',
                                        as: 'audience'
                                    }
                                },
                                {
                                    $addFields: {
                                        audience: {
                                            $map: {
                                                input: '$audience',
                                                as: 'a',
                                                in: '$$a.tabName'
                                            }
                                        }
                                    }
                                },
                                {
                                    $lookup: {
                                        from: 'helparticles',
                                        let: { subtopicId: '$_id' },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ['$topicId', '$$subtopicId'] },
                                                            { $eq: ['$status', 'published'] }
                                                        ]
                                                    }
                                                }
                                            },
                                            { $sort: { createdAt: -1 } },
                                            { $limit: 1 }
                                        ],
                                        as: 'articles'
                                    }
                                },
                                { $addFields: { article: { $arrayElemAt: ['$articles', 0] } } },
                                { $project: { articles: 0 } }
                            ],
                            as: 'innersubtopics'
                        }
                    }
                ],
                as: 'subtopics'
            }
        },

        // Articles directly under this topic
        {
            $lookup: {
                from: 'helparticles',
                let: { topicId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$topicId', '$$topicId'] },
                                    { $eq: ['$status', 'published'] }
                                ]
                            }
                        }
                    },
                    { $sort: { createdAt: -1 } }
                ],
                as: 'articles'
            }
        },

        // Related articles from sibling topics
        {
            $lookup: {
                from: 'helparticles',
                let: { parentId: '$parentId', currentTopicId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $ne: ['$topicId', '$$currentTopicId'] },
                                    { $eq: ['$status', 'published'] }
                                ]
                            }
                        }
                    },
                    { $sort: { createdAt: -1 } },
                    { $limit: 5 }
                ],
                as: 'relatedArticles'
            }
        },

        // ✅ Related topics (siblings)
        {
            $lookup: {
                from: "helptopics",
                let: {
                    parentId: "$parentId",
                    currentTopicId: "$_id",
                    currentTags: { $ifNull: ["$tags", []] },
                },
                pipeline: [
                    {
                        $facet: {
                            related: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $ne: ["$_id", "$$currentTopicId"] }, // exclude self
                                                // { $not: { $in: ["$type", ["article", "innertopic"]] } },
                                                { $eq: ["$type", "topic"] },
                                                { $eq: ["$isActive", true] },
                                                {
                                                    $or: [
                                                        { $eq: ["$parentId", "$$parentId"] }, // same parent
                                                        {
                                                            $gt: [
                                                                {
                                                                    $size: {
                                                                        $setIntersection: [
                                                                            { $ifNull: ["$tags", []] },
                                                                            "$$currentTags"
                                                                        ]
                                                                    }
                                                                },
                                                                0
                                                            ]
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    }
                                },
                                { $sort: { createdAt: -1 } },
                                { $limit: 6 },
                                { $project: { _id: 1, title: 1, slug: 1, tags: 1 } }
                            ],
                            latest: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $ne: ["$_id", "$$currentTopicId"] }, // exclude self
                                                // { $not: { $in: ["$type", ["article", "innertopic"]] } },
                                                { $eq: ["$type", "topic"] },

                                                { $eq: ["$isActive", true] }
                                            ]
                                        }
                                    }
                                },
                                { $sort: { createdAt: -1 } },
                                { $limit: 6 },
                                { $project: { _id: 1, title: 1, slug: 1, tags: 1 } }
                            ]
                        }
                    },
                    {
                        $project: {
                            topics: {
                                $cond: {
                                    if: { $gt: [{ $size: "$related" }, 0] },
                                    then: "$related",
                                    else: "$latest"
                                }
                            }
                        }
                    },
                    { $unwind: "$topics" },
                    { $replaceRoot: { newRoot: "$topics" } }
                ],
                as: "relatedTopics"
            }
        },

        { $limit: 1 }
    ]);


    if (!result || result.length === 0) {
        return res.status(404).json({ message: 'Topic not found' });
    }

    const { subtopics, articles, breadcrumb, relatedArticles, relatedTopics, ...topic } = result[0];
    // Build ordered breadcrumb from root → current topic
    const allTopics = [...breadcrumb, {
        _id: topic._id,
        title: topic.title,
        slug: topic.slug,
        parentId: topic.parentId
    }];

    const orderedBreadcrumb: any[] = [];
    const root = allTopics.find(t => !t.parentId);
    if (root) {
        orderedBreadcrumb.push(root);
        let current = root;
        while (true) {
            const child = allTopics.find(t => String(t.parentId) === String(current._id));
            if (!child) break;
            orderedBreadcrumb.push(child);
            current = child;
        }
    }

    // ✅ Finally add the article as last breadcrumb
    if (articles?.length) {
        const article = articles[0]; // or whichever article you want to show
        orderedBreadcrumb.push({
            _id: article?._id,
            title: article?.title,
            slug: article?.slug,
            type: "article"
        });
    }

    const breadcrumbFormatted = orderedBreadcrumb.map((b, idx) => ({
        _id: b._id,
        title: b.title,
        slug: b.slug,
        to: idx === orderedBreadcrumb.length - 1
            ? "" // last breadcrumb → no link
            : b.slug === "all-topics"
                ? `/help/all-topics`
                : b.type === "article"
                    ? `/help/article/${b._id}`
                    : `/help/topic/${b._id}`
    }));

    return res.json({
        topic,
        breadcrumb: breadcrumbFormatted,
        subtopics,
        articles,
        relatedArticles,
        relatedTopics
    });


};


