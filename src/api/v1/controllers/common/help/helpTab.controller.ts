import { Request, Response } from "express";
import HelpTab from "../../../models/help/helpTabs";

// Public: Get only visible tabs
export const getVisibleHelpTabs = async (req: Request, res: Response) => {
    const tabs = await HelpTab.find({ isVisible: true })
        .select('tabName isVisible')
        .sort({ createdAt: 1 })
        .lean()

    res.json({ success: true, data: tabs });

};