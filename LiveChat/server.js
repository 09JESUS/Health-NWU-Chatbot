const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

admin.initializeApp();

const firestore = admin.firestore();

exports.joinRoom = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const { roomId, userName, userType } = req.body;
    
    if (!roomId || !userName || !userType) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    
    const userRef = firestore.collection('users').doc();
    userRef.set({
      roomId: roomId,
      userName: userName,
      userType: userType
    }).then(() => {
      res.status(200).json({ message: 'User joined room successfully' });
    }).catch(error => {
      res.status(500).json({ error: 'Failed to join room' });
    });
  });
});

exports.sendMessage = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const { roomId, message, sender } = req.body;
    
    if (!roomId || !message || !sender) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    
    const messageRef = firestore.collection('messages').doc();
    messageRef.set({
      roomId: roomId,
      message: message,
      sender: sender,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      res.status(200).json({ message: 'Message sent successfully' });
    }).catch(error => {
      res.status(500).json({ error: 'Failed to send message' });
    });
  });
});
