import admin from 'firebase-admin';
// import path from 'path';

// admin.initializeApp({

//     credential: admin.credential.cert(
//         require(path.resolve(__dirname, './firebase-service-account.json'))
//     ),
// });

// const serviceAccountJson = require(path.resolve(__dirname, './firebase-service-account.json'))
// const base64Encoded = Buffer.from(JSON.stringify(serviceAccountJson)).toString('base64');
// console.log(base64Encoded);

const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_ADMIN_B64!, 'base64').toString('utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
export default admin;
