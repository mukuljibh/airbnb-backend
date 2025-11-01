import { Schema, model } from 'mongoose';

const HelpTabsSchema = new Schema({
    tabName: { type: String, lowercase: true, trim: true },
    isVisible: { type: Boolean, default: true }

}, { timestamps: true });


const HelpTab = model('HelpTab', HelpTabsSchema);

export default HelpTab;

