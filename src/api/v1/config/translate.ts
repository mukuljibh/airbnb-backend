import { Translate } from '@google-cloud/translate/build/src/v2';


 
const translate = new Translate({key:process.env.GOOGLE_TRANSALATE_API_KEY});

export default translate;
