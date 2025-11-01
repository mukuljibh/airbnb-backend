import express from 'express'
import * as commonConversationsControllers from "../../../controllers/common/conversations/conversations.controller"
import { validateIntiateConversation, validateUpdateConversation } from '../../../validation/common/conversations/general.conversation.validation';

const router = express.Router();

//conversation feature points to room table database (conversation == room)
//for enhancing readability we choose name as conversations instead of room

router.get('/', commonConversationsControllers.getAllConversationsList);
router.post('/', validateIntiateConversation, commonConversationsControllers.initiateIntialConversation);
router.patch('/:roomId', validateUpdateConversation, commonConversationsControllers.updateConversation);

//sufix messages point to chatMessages table in database (messages == chatMessage) 
router.get('/:roomId/messages', commonConversationsControllers.getAllConversationsByRoomId);
router.patch('/:roomId/messages/:messageId', commonConversationsControllers.updateChatMessageById)
router.delete('/:roomId/messages/:messageId', commonConversationsControllers.deleteChatMessageById)



export default router