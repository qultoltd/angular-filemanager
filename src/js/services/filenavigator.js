(function(angular) {
    'use strict';
    angular.module('FileManagerApp').service('fileNavigator', [
        'apiMiddleware', 'fileManagerConfig', 'item', function (ApiMiddleware, fileManagerConfig, Item) {

        var FileNavigator = function() {
            this.apiMiddleware = new ApiMiddleware();
            this.requesting = false;
            this.fileList = [];
            this.currentPath = getFolderPathArray();
            this.history = [];
            this.error = '';

            this.onRefresh = function() {};
        };

            function getFolderPathArray() {
                var folderPathArray = [];
                const pathParamString = window.location.href.split("?", 2)[1];
                if (pathParamString != null) {
                    const pathParams = pathParamString.split("&");
                    pathParams.forEach(function (path) {
                        if (path.includes("folder=")) {
                            folderPathArray = convertFolderPathParamToArray(path.split("=")[1]);
                        }
                    });
                }
                return folderPathArray;
            }

            function convertFolderPathParamToArray(folderString) {
                const pathArray = [];
                const fileUrnArray = folderString.split(':');
                var folderArray;
                if (fileUrnArray.length === 2) {
                    pathArray[0] = fileUrnArray[0];
                    folderArray = decodeURIComponent(fileUrnArray[1]).split("/").slice(0, -1);
                    folderArray.forEach(function (folderName, i) {
                        pathArray[i + 1] = folderName;
                    });
                }
                return pathArray;
            }

        FileNavigator.prototype.deferredHandler = function(data, deferred, code, defaultMsg) {
            if ((!data || typeof data !== 'object') && !defaultMsg) {
                this.error = 'Error %s - Bridge response error, please check the API docs or this ajax response.'.replace('%s', code);
            }
            if (code == 404) {
                this.error = 'Error 404 - Backend bridge is not working, please check the ajax response.';
            }
            if (data && data.result && data.result.error) {
                this.error = data.result.error;
            }
            if (!this.error && data && data.error) {
                this.error = data.error.message;
            }
            if (!this.error && defaultMsg) {
                this.error = defaultMsg;
            }
            if (this.error) {
                return deferred.reject(data);
            }
            return deferred.resolve(data);
        };

        FileNavigator.prototype.list = function(modifiedSince) {
            return this.apiMiddleware.list(this.currentPath, this.deferredHandler.bind(this), modifiedSince);
        };

        FileNavigator.prototype.initCurrentPath = function(newPath) {
            return this.currentPath = newPath;
        };

        FileNavigator.prototype.refresh = function() {
            var self = this;
            if (self.currentPath === undefined || self.currentPath.length === undefined || self.currentPath.length === 0) {
                self.currentPath = [];
            }
            var path = self.currentPath.join('/');
            self.requesting = true;
            self.fileList = [];
            return self.list().then(function(data) {
                self.fileList = (data.result || []).map(function(file) {
                    return new Item(file, self.currentPath);
                });
                self.buildTree(path);
                self.onRefresh();
            }).finally(function() {
                self.requesting = false;
            });
        };


        FileNavigator.prototype.updateStatus = function() {
          var self = this;
            //Is user logged in?
            self.apiMiddleware.isAuthenticated().then(function(response) {
              if (response.result === undefined || response.result.userId === undefined) {
                return;
              }
              if (self.currentPath === undefined || self.currentPath.length === undefined || self.currentPath.length === 0) {
                  self.currentPath = [];
              }
              var path = self.currentPath.join('/');
              //self.requesting = true;
              //self.fileList = [];
              var modifiedSince = new Date().getTime() - 10000;
              return self.list(modifiedSince).then(function(data) {
                if(data.result && data.result.length > 0) {
                  angular.forEach(data.result, function(currentFile) {
                    angular.forEach(self.fileList, function(fileItem) {
                      if(fileItem.model.name === currentFile.name) {
                        fileItem.model.modificationDate = new Date(currentFile.modificationDate);
                        //fileItem.model.reportModificationDate = new Date(currentFile.reportModificationDate);
                        fileItem.model.processingStatus = currentFile.processingStatus;
                        //fileItem.model.hasReport = currentFile.hasReport;
                      }
                    });
                  });
                }

                  /*self.fileList = (data.result || []).map(function(file) {
                      return new Item(file, self.currentPath);
                  });
                  self.buildTree(path);
                  self.onRefresh();*/
              }).finally(function() {
                  //self.requesting = false;
              });
            }, function(error) {

            })


        };

        FileNavigator.prototype.buildTree = function(path) {
            var flatNodes = [], selectedNode = {};

            function recursive(parent, item, path) {
                var absName = path ? (path + '/' + item.model.name) : item.model.name;
                if (parent.name && parent.name.trim() && path.trim().indexOf(parent.name) !== 0) {
                    parent.nodes = [];
                }
                if (parent.name !== path) {
                    parent.nodes.forEach(function(nd) {
                        recursive(nd, item, path);
                    });
                } else {
                    for (var e in parent.nodes) {
                        if (parent.nodes[e].name === absName) {
                            return;
                        }
                    }
                    parent.nodes.push({item: item, name: absName, nodes: []});
                }

                parent.nodes = parent.nodes.sort(function(a, b) {
                    return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() === b.name.toLowerCase() ? 0 : 1;
                });
            }

            function flatten(node, array) {
                array.push(node);
                for (var n in node.nodes) {
                    flatten(node.nodes[n], array);
                }
            }

            function findNode(data, path) {
                return data.filter(function (n) {
                    return n.name === path;
                })[0];
            }

            //!this.history.length && this.history.push({name: '', nodes: []});
            !this.history.length && this.history.push({ name: '', nodes: [] });
            flatten(this.history[0], flatNodes);
            selectedNode = findNode(flatNodes, path);
            selectedNode && (selectedNode.nodes = []);

            for (var o in this.fileList) {
                var item = this.fileList[o];
                item instanceof Item && item.isFolder() && recursive(this.history[0], item, path);
            }
        };

        FileNavigator.prototype.folderClick = function(item) {
            this.currentPath = [];
            if (item && item.isFolder()) {
                this.currentPath = item.model.fullPath().split('/').splice(1);
            }
            this.refresh();
        };

        FileNavigator.prototype.upDir = function() {
            if (this.currentPath[0]) {
                this.currentPath = this.currentPath.slice(0, -1);
                this.refresh();
            }
        };

        FileNavigator.prototype.goTo = function(index) {
            this.currentPath = this.currentPath.slice(0, index + 1);
            this.refresh();
        };

        FileNavigator.prototype.fileNameExists = function(fileName) {
            return this.fileList.find(function(item) {
                return fileName.trim && item.model.name.trim() === fileName.trim();
            });
        };

        FileNavigator.prototype.listHasFolders = function() {
            return this.fileList.find(function(item) {
                return item.model.type === 'dir';
            });
        };

        return FileNavigator;
    }]);
})(angular);
