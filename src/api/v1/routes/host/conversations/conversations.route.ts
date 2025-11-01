import express from 'express'
import * as  commonConversationsControllers from "../../../controllers/common/conversations/conversations.controller"
import createPages from '../../../middleware/pagination/pagination.middleware';
import { validateIntiateConversation, validateUpdateConversation } from '../../../validation/common/conversations/general.conversation.validation';
const router = express.Router();



router.get('/', createPages, commonConversationsControllers.getAllConversationsList);
router.post('/', validateIntiateConversation, commonConversationsControllers.initiateIntialConversation);
router.patch('/:roomId', validateUpdateConversation, commonConversationsControllers.updateConversation);
router.get('/:roomId/messages', createPages, commonConversationsControllers.getAllConversationsByRoomId);
router.patch('/:roomId/messages/:messageId', commonConversationsControllers.updateChatMessageById)
router.delete('/:roomId/messages/:messageId', commonConversationsControllers.deleteChatMessageById)

export default router