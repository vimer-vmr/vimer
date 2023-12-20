// All the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

const { contextBridge, ipcRenderer } = require('electron');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  readconfig: (filename) => readconfig(filename),
  storeData: (outputFolder, participantCode, configFilename, videoFilename, data) => storedata(outputFolder, participantCode, configFilename, videoFilename, data),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory')
})

function readconfig(filename) {
  config = {}
  try {
    config = yaml.load(fs.readFileSync(filename, 'utf8'));
  } catch (e) {
    console.log(e);
  }
  return config
}

function storedata(outputFolder, participantCode, configFilename, videoFilename, data) {
  filename = outputFolder + path.sep + participantCode + "_" + path.parse(configFilename).name + "_" + path.parse(videoFilename).name + ".csv";
  fs.appendFileSync(filename, data);
}