import express from 'express';
import * as commonConversationsControllers from "../../../controllers/common/conversations/conversations.controller"

const router = express.Router();


router.get('/', commonConversationsControllers.getAllConversationsList);
router.get('/:roomId/messages', commonConversationsControllers.getAllConversationsByRoomId);
router.patch('/:roomId/messages/:messageId', commonConversationsControllers.updateChatMessageById)
router.delete('/:roomId/messages/:messageId', commonConversationsControllers.deleteChatMessageById)


export default router;
