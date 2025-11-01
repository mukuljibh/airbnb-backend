import mongoose, { Schema } from 'mongoose';
import {
    IReportFlow,
    IUserFlagFlow,
    IPage,
    IHelpArticle,
    ISelectOption,
    IPrimaryButton,
    ISecondaryButton,
} from './types';

const HelpArticleSchema = new Schema<IHelpArticle>({
    name: String,
    link: String,
}, { _id: true });

const SelectOptionSchema = new Schema<ISelectOption>({
    id: String,
    title: String,
    subtitle: String,
    nextPage: String,
    action: String,
}, { _id: true });

const PrimaryButtonSchema = new Schema<IPrimaryButton>({
    label: String,
    nextPage: String,
    action: String,
    operationType: Number,
}, { _id: true });

const SecondaryButtonSchema = new Schema<ISecondaryButton>({
    label: String,
    operationType: Number,
}, { _id: true });

const PageSchema = new Schema<IPage>({
    name: { type: String, required: true },
    type: { type: String, required: true },
    fieldName: String,
    title: String,
    subtitle: String,
    textareaPlaceholder: String,
    textareaMaxlength: Number,
    feedbackTitle: String,
    paragraphs: [String],
    helpArticles: [HelpArticleSchema],
    relatedArticlesTitle: String,
    secondaryLinkLabel: String,
    secondaryLink: String,
    selectOptions: [SelectOptionSchema],
    primaryButton: PrimaryButtonSchema,
    secondaryButton: SecondaryButtonSchema,
    nextSteps: [String],
}, { _id: true });

const UserFlagFlowSchema = new Schema<IUserFlagFlow>({
    name: { type: String, required: true },
    pages: [PageSchema],
}, { _id: true });

const ReportFlowSchema = new Schema<IReportFlow>({
    userFlagFlows: [UserFlagFlowSchema],
}, { timestamps: true });

const ReportFlowModel = mongoose.model('ReportFlow', ReportFlowSchema);

export { ReportFlowModel };