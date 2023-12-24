const Redis = require('../utils/redis');
const Mongo = require('../utils/db');
const sha1 = require('sha1');
const mongodb = require('mongodb');
const { v4: uuid } = require('uuid');
const fs = require('fs');

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    const authToken = `auth_${token}`;
    const curUserToken = await Redis.get(authToken);
    if (!curUserToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { name, type, parentId = 0, isPublic = false, data } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    const allowedTypes = ['folder', 'file', 'image']
    if (!type || !allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }
    if (parentId !== 0) {
      const project = new mongodb.ObjectId(parentId);
      const file = await Mongo.files.findOne({ _id: project });

      if (!file) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (file.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
  }
  // The user ID should be added to the document saved in DB - as owner of a file
  let newFile;
  if (type === "folder") {
    newFile = await Mongo.files.insertOne({
      userId: new mongodb.ObjectId(curUserToken),
      name,
      type,
      isPublic,
      parentId
    });
  } else {
    const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(FOLDER_PATH)) {
      fs.mkdirSync(FOLDER_PATH);
    }
    const localPath = `${FOLDER_PATH}/${uuid()}`
    const dataDecoded = Buffer.from(req.body.data, 'base64').toString('utf-8');
    await fs.promises.writeFile(localPath, dataDecoded);
    newFile = await Mongo.files.insertOne({
      userId: new mongodb.ObjectId(curUserToken),
      name,
      type,
      isPublic,
      parentId,
      localPath
    });
  }
    return res.status(201).send({
      id: newFile.insertedId, userId: curUserToken, name, type, isPublic, parentId,
    });
}
}

module.exports = FilesController;
