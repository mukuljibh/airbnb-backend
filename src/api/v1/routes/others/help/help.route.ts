import express from 'express';
import * as commonTopicController from '../../../controllers/common/help/helpTopic.controller';
import * as commonArticleController from '../../../controllers/common/help/helpArticle.controller';
import { getVisibleHelpTabs } from '../../../controllers/common/help/helpTab.controller';



const router = express.Router();


// Public endpoint
router.get("/tabs", getVisibleHelpTabs);
router.get('/topics', commonTopicController.getActiveTopics);
router.get('/topics/active', commonTopicController.getActiveTopicsInfiniteScroll);
router.get('/topics/:slug', commonTopicController.getTopicBySlug);
router.get('/topic/:id', commonTopicController.getTopicById);
router.get('/articles', commonArticleController.getHelpCenterArticles);
router.get('/article/:id', commonArticleController.getArticleById);
router.get('/search', commonArticleController.searchArticles);
router.get('/top-articles', commonArticleController.getTopArticle);

export default router;
