import { Request, Response } from "express";
import HelpArticle from "../../../models/help/helpArticle";
import HelpTopic from "../../../models/help/helpTopic";
import mongoose from "mongoose";
import HelpTab from "../../../models/help/helpTabs";



export const getHelpCenterArticles = async (
    req: Request,
    res: Response
) => {
    const {
        slug,
        search,       // keyword for search
        audience,     // filter
        topicId,      // filter
        sortBy = "createdAt",
        sortOrder = "desc",
        page = 1,
        limit = 10
    } = req.query as Record<string, string>;



    const result = await HelpTab.aggregate(
        [
            {
                $match: {
                    isVisible: true
                }
            },
            {
                $lookup: {
                    from: "helparticles",
                    localField: '_id',
                    foreignField: 'audience',
                    pipeline: [
                        {
                            $match: {
                                status: 'published'
                            }
                        },
                        {
                            $sort: {
                                createdAt: -1
                            }
                        },
                        {
                            $project: {
                                views: 1,
                                image: 1,
                                slug: 1,
                                metaTitle: 1,
                                title: 1,
                                metaDescription: 1
                            }
                        }
                    ],
                    as: 'generalArticles',
                }
            },
            {
                $lookup: {
                    from: "helparticles",
                    localField: '_id',
                    foreignField: 'audience',
                    pipeline: [
                        {
                            $match: {
                                status: 'published'
                            }
                        },
                        {
                            $sort: {
                                views: -1
                            }
                        },
                        {
                            $project: {
                                views: 1,
                                image: 1,
                                slug: 1,
                                metaTitle: 1,
                                title: 1,
                                metaDescription: 1
                            }
                        }
                    ],
                    as: 'topArticles',
                }
            },
            {
                $project: {
                    tabName: 1,
                    isVisible: 1,
                    topArticles: 1,
                    generalArticles: 1


                }
            }
        ]
    )

    return res.json({
        data: result

    });

};
export const searchArticles = async (req: Request, res: Response) => {
    const { q } = req.query;

    if (!q || typeof q !== "string" || !q.trim()) {
        return res.status(400).json({
            error: 'Query parameter "q" must be a non-empty string',
        });
    }

    const regex = new RegExp(q.trim(), "i");

    const results = await HelpArticle.find({
        status: "published",
        title: { $regex: regex },
    }).select("title _id");


    return res.json({ data: results });
};



export const getArticleById = async (req: Request, res: Response) => {
    const identifier = req.params.id; // could be ObjectId or slug

    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    const articleQuery = isObjectId
        ? { _id: new mongoose.Types.ObjectId(identifier) }
        : { slug: { $regex: new RegExp(`^${identifier}$`, "i") } };

    let article = await HelpArticle.findOneAndUpdate(articleQuery,
        { $inc: { views: 1 } },
        { new: true })
        .populate('audience', 'tabName')
        .lean();

    if (!article) {
        return res.status(404).json({ message: "Article not found" });
    }

    let breadcrumb: any[] = [];

    if (article.topicId) {
        const [topicResult] = await HelpTopic.aggregate([
            { $match: { _id: article.topicId, isActive: true } },
            {
                $graphLookup: {
                    from: "helptopics",
                    startWith: "$parentId",
                    connectFromField: "parentId",
                    connectToField: "_id",
                    as: "breadcrumb",
                    restrictSearchWithMatch: { isActive: true }
                }
            }
        ]);

        if (topicResult) {
            const topic = topicResult;

            // Merge parents + current topic
            const allTopics = [
                ...topic.breadcrumb,
                // {
                //     _id: topic._id,
                //     title: topic.title,
                //     slug: topic.slug,
                //     parentId: topic.parentId
                // }
            ];

            // Find root topic
            const root = allTopics.find(t => !t.parentId);

            if (root) {
                breadcrumb = [{
                    _id: root._id,
                    title: root.title,
                    slug: root.slug,
                    parentId: root.parentId,
                    to: `/help/all-topics`
                }];

                let current = root;
                while (true) {
                    const child = allTopics.find(t => String(t.parentId) === String(current._id));
                    if (!child) break;
                    breadcrumb.push({
                        _id: child._id,
                        title: child.title,
                        slug: child.slug,
                        parentId: child.parentId,
                        to: `/help/topic/${child._id}`
                    });
                    current = child;
                }
            }
        }
    }

    // 🔹 If last breadcrumb matches article.slug, replace it with article (no link)
    if (
        breadcrumb.length &&
        breadcrumb[breadcrumb.length - 1].slug?.trim().toLowerCase() ===
        article.slug.trim().toLowerCase()
    ) {
        breadcrumb[breadcrumb.length - 1] = {
            _id: article._id,
            title: article.title,
            slug: article.slug,
            parentId: article.topicId,
            to: "" // last item is non-clickable
        };
    } else {
        // Otherwise, push article at the end
        breadcrumb.push({
            _id: article._id,
            title: article.title,
            slug: article.slug,
            parentId: article.topicId,
            to: ""
        });
    }

    // Related articles
    const relatedArticles = await HelpArticle.find({
        _id: { $ne: article._id },
        status: "published",
        $or: [
            { topicId: article.topicId },
            { tags: { $in: article.tags || [] } }
        ]
    })
        .select("title slug metaDescription createdAt")
        .limit(5)
        .sort({ createdAt: -1 })
        .lean();

    res.json({
        data: {
            article,
            relatedArticles,
            breadcrumb
        }
    });


};



export const getTopArticle = async (
    req: Request,
    res: Response
) => {
    const tabs = await HelpTab.find({ isVisible: false }).select('_id').lean()

    const articles = await HelpArticle.find({ status: "published", audience: { $nin: tabs.map(x => x._id) } })
        .sort({ views: -1 })
        .limit(6);

    res.json({
        success: true,
        total: articles.length,
        data: articles
    });

};