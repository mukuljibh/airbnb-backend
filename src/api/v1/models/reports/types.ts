import { Document } from "mongoose";

export interface IHelpArticle {
    name: string;
    link: string;
}

export interface ISelectOption {
    id: string;
    title: string;
    subtitle: string;
    nextPage?: string;
    action?: string;
}

export interface IPrimaryButton {
    label: string;
    nextPage?: string;
    action?: string;
    operationType?: number;
}

export interface ISecondaryButton {
    label: string;
    operationType?: number;
}

export interface IPage {
    name: string;
    type: string;
    fieldName?: string;
    title?: string;
    subtitle?: string;
    textareaPlaceholder?: string;
    textareaMaxlength?: number;
    feedbackTitle?: string;
    paragraphs?: string[];
    helpArticles?: IHelpArticle[];
    relatedArticlesTitle?: string;
    secondaryLinkLabel?: string;
    secondaryLink?: string;
    selectOptions?: ISelectOption[];
    primaryButton?: IPrimaryButton;
    secondaryButton?: ISecondaryButton;
    nextSteps?: string[];
}

export interface IUserFlagFlow {
    name: string;
    pages: IPage[];
}

export interface IReportFlow extends Document {
    userFlagFlows: IUserFlagFlow[];
}