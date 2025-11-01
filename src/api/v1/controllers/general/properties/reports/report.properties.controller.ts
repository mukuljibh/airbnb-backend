import { Request, Response } from "express";
import { ReportFlowModel } from "../../../../models/reports/reports";

export const createReportFlow = async (req: Request, res: Response) => {
    try {
        const { user_flag_flows } = req.body;

        if (!user_flag_flows || !Array.isArray(user_flag_flows)) {
            return res.status(400).json({ message: "Invalid report flow structure" });
        }

        const flow = await ReportFlowModel.create({ user_flag_flows });
        return res.status(201).json({ message: "Report flow created", data: flow });
    } catch (error) {
        console.error("Create flow error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};



