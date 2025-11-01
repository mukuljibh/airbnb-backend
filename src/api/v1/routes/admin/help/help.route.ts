import express from 'express';
import * as topicController from '../../../controllers/admin/help/helpTopic.controller';
import * as articleController from '../../../controllers/admin/help/helpArticle.controller';
import * as tabController from '../../../controllers/admin/help/helpTab.controller';
import { getActiveTopicsInfiniteScroll } from '../../../controllers/common/help/helpTopic.controller';
import * as  helpCenterValidator from '../../../validation/admin/help/help.validation'


const router = express.Router();

// router.get('/topics/options', topicController.getTopicFormOptions)
router.get('/topics/active', getActiveTopicsInfiniteScroll);
router.get('/topics', topicController.getActiveTopics);
router.post('/topics', helpCenterValidator.helpTopicValidator, topicController.createTopic);
router.get('/topics/:id', topicController.getTopicById);
router.put('/topics/:id', helpCenterValidator.helpTopicValidator, topicController.updateTopic);
router.delete('/topics/:id', topicController.deleteTopic);

router.get('/articles', articleController.getArticleBySlug);
router.post('/articles', helpCenterValidator.helpArticleValidator, articleController.createArticle);
router.get('/article/:id', articleController.getArticleById);
router.put('/articles/:id', helpCenterValidator.helpArticleValidator, articleController.updateArticle);
router.delete('/articles/:id', articleController.deleteArticle);

router.get('/tabs', tabController.getAllHelpTabs);
router.post('/tabs', helpCenterValidator.helpTabValidator, tabController.createHelpTab);
router.get('/tab/:id', tabController.getHelpTabDetail);
router.put('/tabs/:id', helpCenterValidator.helpTabValidator, tabController.updateHelpTab);
router.delete('/tabs/:id', tabController.deleteHelpTab);

export default router;