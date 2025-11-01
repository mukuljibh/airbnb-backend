import { Request, Response } from "express";
import HelpTab from "../../../models/help/helpTabs";
import HelpTopic from "../../../models/help/helpTopic";
import HelpArticle from "../../../models/help/helpArticle";
import { ApiResponse } from "../../../utils/error-handlers/ApiResponse";
import { ApiError } from "../../../utils/error-handlers/ApiError";


export const getAllHelpTabs = async (req: Request, res: Response) => {

    const {
        page = 1,
        limit = 10,
        search = "",
        sortBy = "createdAt",
        sortOrder = "asc",
        status,
    } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
        status?: string;
    };

    // Convert to numbers
    const pageNumber = Math.max(parseInt(page as string, 10), 1);
    const limitNumber = Math.max(parseInt(limit as string, 10), 1);

    // Build filter object
    const filter: any = {};

    if (search) {
        filter.tabName = { $regex: search, $options: "i" }; // case-insensitive search
    }

    if (status) {
        filter.status = status; // exact match
    }

    // Count total documents
    const total = await HelpTab.countDocuments(filter);

    // Query with pagination, filtering, sorting
    const tabs = await HelpTab.find(filter)
        .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);

    res.json({
        success: true,
        data: tabs,
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
    });

};


export const createHelpTab = async (req: Request, res: Response) => {
    const { tabName, isVisible } = req.body;

    if (!tabName) {
        return res
            .status(400)
            .json({ success: false, message: "tabName is required" });
    }

    const existingTab = await HelpTab.findOne({
        tabName: { $regex: `^${tabName}$`, $options: 'i' }
    });

    if (existingTab) {
        return res
            .status(400)
            .json({ success: false, message: "Tab name already exists" });
    }

    const newTab = await HelpTab.create({
        tabName: tabName.trim(),
        isVisible,
    });

    return res.json(new ApiResponse(201, 'Help tab created successfully', newTab))

};


export const updateHelpTab = async (req: Request, res: Response) => {

    const { id } = req.params;
    const { tabName, isVisible } = req.body;

    if (!tabName) {
        return res
            .status(400)
            .json({ success: false, message: "tabName is required" });
    }

    const existingTab = await HelpTab.findById(id);
    if (!existingTab) {
        throw new ApiError(404, "Tab not found")
    }

    existingTab.tabName = tabName.trim();
    // existingTab.tabValue = newTabValue;
    if (typeof isVisible === "boolean") {
        existingTab.isVisible = isVisible;
    }

    const updatedTab = await existingTab.save();

    res.json(new ApiResponse(200, 'Help tab updated successfully', updatedTab));

};


// Admin: Delete a tab
export const deleteHelpTab = async (req: Request, res: Response) => {

    const { id } = req.params;

    const existingTab = await HelpTab.findById(id);
    if (!existingTab) {
        return res.status(404).json({ success: false, message: "Tab not found" });
    }

    // Check if in use
    const inUseInTopics = await HelpTopic.exists({ audience: { $in: [existingTab._id] } });
    const inUseInArticles = await HelpArticle.exists({ audience: existingTab._id });

    if (inUseInTopics || inUseInArticles) {
        return res.status(400).json({
            success: false,
            message: `The tab "${existingTab.tabName}" cannot be deleted because it is currently linked to existing topics, innertopic or articles. Please remove these associations before attempting deletion.`,
        });
    }


    await HelpTab.findByIdAndDelete(id);
    res.json({ success: true, message: "Tab deleted successfully" });


};

export const getHelpTabDetail = async (req: Request, res: Response) => {
    const { id } = req.params;
    const helpTab = await HelpTab.findById(id);

    if (!helpTab) {
        return res.status(404).json({ success: false, message: "Tab not found" });
    }

    res.json({ success: true, data: helpTab });

};
