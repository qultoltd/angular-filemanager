(function(angular, $) {
    'use strict';
    angular.module('FileManagerApp').service('apiHandler', ['$http', '$q', '$window', '$translate', 'Upload',
        function ($http, $q, $window, $translate, Upload) {

        $http.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

        var ApiHandler = function() {
            this.inprocess = false;
            this.asyncSuccess = false;
            this.error = '';
        };

        ApiHandler.prototype.deferredHandler = function(data, deferred, code, defaultMsg) {
            if ((!data || typeof data !== 'object') && !defaultMsg) {
                this.error = 'Error %s - Bridge response error, please check the API docs or this ajax response.'.replace('%s', code);
            }
            
            if (code == 404) {
                this.error = 'Error 404 - Backend bridge is not working, please check the ajax response.';
            }

            /*if (code == 403) {
                
                console.log("403 error occured.");
                this.error = 'You can not upload file(s) into the root folder.';
            }*/

            if (data && data.result && data.result.error) {
                this.error = data.result.error;
            }
            if (!this.error && data && data.error) {
                this.error = data.error.message;
            }
            if (!this.error && defaultMsg) {
                this.error = defaultMsg;
            }

            if(data != null) {

                if(typeof data !== 'object') {
                    
                    data = {
                        result: data,
                        code: code
                    };
                } else {
                    data.code = code;
                }
            }

            if (this.error) {
                return deferred.reject(data);
            }
            return deferred.resolve(data);
        };

        ApiHandler.prototype.list = function(apiUrl, path, customDeferredHandler, modifiedSince) {
            var self = this;
            var dfHandler = customDeferredHandler || self.deferredHandler;
            var deferred = $q.defer();
            var data = {
                action: 'list',
                path: path
            };
            if (modifiedSince) {
              data.modifiedSince = modifiedSince;
            }

            self.inprocess = true;
            self.error = '';

            $http.post(apiUrl, data).success(function(data, code) {
                dfHandler(data, deferred, code);
            }).error(function(data, code) {
                dfHandler(data, deferred, code, 'Unknown error listing, check the response');
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };

        ApiHandler.prototype.copy = function(apiUrl, items, path, singleFilename) {
            var self = this;
            var deferred = $q.defer();
            var data = {
                action: 'copy',
                items: items,
                newPath: path
            };

            if (singleFilename && items.length === 1) {
                data.singleFilename = singleFilename;
            }

            self.inprocess = true;
            self.error = '';
            $http.post(apiUrl, data).success(function(data, code) {
                self.deferredHandler(data, deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_copying'));
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };

        ApiHandler.prototype.move = function(apiUrl, items, path) {
            var self = this;
            var deferred = $q.defer();
            var data = {
                action: 'move',
                items: items,
                newPath: path
            };
            self.inprocess = true;
            self.error = '';
            $http.post(apiUrl, data).success(function(data, code) {
                self.deferredHandler(data, deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_moving'));
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };

        ApiHandler.prototype.remove = function(apiUrl, items) {
            var self = this;
            var deferred = $q.defer();
            var data = {
                action: 'remove',
                items: items
            };

            self.inprocess = true;
            self.error = '';
            $http.post(apiUrl, data).success(function(data, code) {
                self.deferredHandler(data, deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_deleting'));
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };

        ApiHandler.prototype.checkBeforeRemove = function(apiUrl, items) {
            var self = this;
            var deferred = $q.defer();
            var data = {
                action: 'remove',
                items: items
            };

            self.inprocess = true;
            self.error = '';
            $http.post(apiUrl, data).success(function(data, code) {
                self.deferredHandler(data, deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_delete_check'));
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };

        ApiHandler.prototype.upload = function(apiUrl, destination, files) {
            var self = this;
            var deferred = $q.defer();
            self.inprocess = true;
            self.progress = 0;
            self.error = '';

            var data = {
                destination: destination
            };

            for (var i = 0; i < files.length; i++) {
                data['file-' + i] = files[i];
            }

            if (files && files.length) {
                Upload.upload({
                    url: apiUrl,
                    data: data
                }).then(function (data) {
                    self.deferredHandler(data.data, deferred, data.status);
                }, function (data) {                    
                    self.deferredHandler(data.data, deferred, data.status, 'Unknown error uploading files');
                }, function (evt) {
                    self.progress = Math.min(100, parseInt(100.0 * evt.loaded / evt.total)) - 1;
                })['finally'](function() {
                    self.inprocess = false;
                    self.progress = 0;
                });
            }

            return deferred.promise;
        };

        ApiHandler.prototype.getContent = function(apiUrl, itemPath) {
            var self = this;
            var deferred = $q.defer();
            var data = {
                action: 'getContent',
                item: itemPath
            };

            self.inprocess = true;
            self.error = '';
            $http.post(apiUrl, data).success(function(data, code) {
                self.deferredHandler(data, deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_getting_content'));
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };

        ApiHandler.prototype.edit = function(apiUrl, itemPath, content) {
            var self = this;
            var deferred = $q.defer();
            var data = {
                action: 'edit',
                item: itemPath,
                content: content
            };

            self.inprocess = true;
            self.error = '';

            $http.post(apiUrl, data).success(function(data, code) {
                self.deferredHandler(data, deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_modifying'));
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };

        ApiHandler.prototype.rename = function(apiUrl, itemPath, newPath) {
            var self = this;
            var deferred = $q.defer();
            var data = {
                action: 'rename',
                item: itemPath,
                newItemPath: newPath
            };
            self.inprocess = true;
            self.error = '';
            $http.post(apiUrl, data).success(function(data, code) {
                self.deferredHandler(data, deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_renaming'));
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };

        ApiHandler.prototype.getUrl = function(apiUrl, path, objectId) {
            var data = {
                action: 'download',
                path: path,
                objectId: objectId
            };
            return path && [apiUrl, $.param(data)].join('?');
        };

        ApiHandler.prototype.download = function(apiUrl, itemPath, toFilename, objectId, downloadByAjax, forceNewWindow) {
            var self = this;
            var url = this.getUrl(apiUrl, itemPath, objectId);

            if (!downloadByAjax || forceNewWindow || !$window.saveAs) {
                !$window.saveAs && $window.console.log('Your browser dont support ajax download, downloading by default');
                return !!$window.open(url, '_blank', '');
            }

            var deferred = $q.defer();
            self.inprocess = true;
            $http.get(url).success(function(data) {
                var bin = new $window.Blob([data]);
                deferred.resolve(data);
                $window.saveAs(bin, toFilename);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_downloading'));
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };

        ApiHandler.prototype.downloadMultiple = function(apiUrl, items, toFilename, downloadByAjax, forceNewWindow) {
            var self = this;
            var deferred = $q.defer();
            var data = {
                action: 'downloadMultiple',
                items: items,
                toFilename: toFilename
            };
            var url = [apiUrl, $.param(data)].join('?');

            if (!downloadByAjax || forceNewWindow || !$window.saveAs) {
                !$window.saveAs && $window.console.log('Your browser dont support ajax download, downloading by default');
                return !!$window.open(url, '_blank', '');
            }

            self.inprocess = true;
            $http.get(apiUrl).success(function(data) {
                var bin = new $window.Blob([data]);
                deferred.resolve(data);
                $window.saveAs(bin, toFilename);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_downloading'));
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };

        ApiHandler.prototype.compress = function(apiUrl, items, compressedFilename, path) {
            var self = this;
            var deferred = $q.defer();
            var data = {
                action: 'compress',
                items: items,
                destination: path,
                compressedFilename: compressedFilename
            };

            self.inprocess = true;
            self.error = '';
            $http.post(apiUrl, data).success(function(data, code) {
                self.deferredHandler(data, deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_compressing'));
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };

        ApiHandler.prototype.extract = function(apiUrl, item, folderName, path) {
            var self = this;
            var deferred = $q.defer();
            var data = {
                action: 'extract',
                item: item,
                destination: path,
                folderName: folderName
            };

            self.inprocess = true;
            self.error = '';
            $http.post(apiUrl, data).success(function(data, code) {
                self.deferredHandler(data, deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_extracting'));
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };

        ApiHandler.prototype.changePermissions = function(apiUrl, items, permsOctal, permsCode, recursive) {
            var self = this;
            var deferred = $q.defer();
            var data = {
                action: 'changePermissions',
                items: items,
                perms: permsOctal,
                permsCode: permsCode,
                recursive: !!recursive
            };

            self.inprocess = true;
            self.error = '';
            $http.post(apiUrl, data).success(function(data, code) {
                self.deferredHandler(data, deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_changing_perms'));
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };

        ApiHandler.prototype.createFolder = function(apiUrl, path, maxSectionLength) {
            var self = this;
            var deferred = $q.defer();
            var data = {
                action: 'createFolder',
                newPath: path,
                maxSectionLength: maxSectionLength
            };

            self.inprocess = true;
            self.error = '';
            $http.post(apiUrl, data).success(function(data, code) {
                self.deferredHandler(data, deferred, code);
            }).error(function(data, code) {
              if (code == 409) {
                  self.deferredHandler(data, deferred, code, $translate.instant('error_creating_folder_already_exists'));
              } else {
                  self.deferredHandler(data, deferred, code, $translate.instant('error_creating_folder'));
              }
            })['finally'](function() {
                self.inprocess = false;
            });

            return deferred.promise;
        };

        ApiHandler.prototype.startReportGeneration = function(apiUrl, report) {
            var self = this;
            var deferred = $q.defer();
            var data = report;

            self.inprocess = true;
            self.error = '';
            $http.post(apiUrl, data).success(function(data, code) {
                self.deferredHandler({result: data}, deferred, code);
            }).error(function(data, code) {
              if (code === 409) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_not_unique_report_name'));
              } else {
                self.deferredHandler(data, deferred, code, $translate.instant('error_starting_report_generation'));
              }
            })['finally'](function() {
                self.inprocess = false;
            });

            return deferred.promise;
        };

        ApiHandler.prototype.cancelReportGeneration = function(apiUrl, reportId) {
            const self = this;
            const deferred = $q.defer();
            self.inprocess = true;
            self.error = '';
            apiUrl += "/" + reportId;
            $http.delete(apiUrl).success(function(data, code) {
                self.deferredHandler("",  deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_canceling_report_generation'));
            })['finally'](function() {
                self.inprocess = false;
            });
            return deferred.promise;
        };


        ApiHandler.prototype.startBatchReportGeneration = function(apiUrl, report) {
            var self = this;
            var deferred = $q.defer();
            var data = report;

            self.inprocess = true;
            self.error = '';
            $http.post(apiUrl, data).success(function(data, code) {
                self.deferredHandler({result: data}, deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_starting_batch_report_generation'));
            })['finally'](function() {
                self.inprocess = false;
            });

            return deferred.promise;
        };

        ApiHandler.prototype.listReports = function(apiUrl, path) {
            var self = this;
            var deferred = $q.defer();

            var request = {
               method: 'POST',
               url: apiUrl,
               headers: {
                 'Content-Type': 'text/plain'
               },
               data: path
            };

            self.inprocess = true;
            self.error = '';
            $http(request).success(function(data, code) {
                self.deferredHandler({result: data}, deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_listing_reports'));
            })['finally'](function() {
                self.inprocess = false;
            });

            return deferred.promise;
        };

        ApiHandler.prototype.isAuthenticated = function(apiUrl) {
            var self = this;
            var deferred = $q.defer();

            if (apiUrl === undefined || apiUrl === '') {
              return deferred.promise;
            }

            var request = {
               method: 'GET',
               url: apiUrl
            };

            self.inprocess = true;
            self.error = '';
            $http(request).success(function(data, code) {
                self.deferredHandler({result: data}, deferred, code);
            }).error(function(data, code) {
                self.deferredHandler(data, deferred, code, $translate.instant('error_authenticating_user'));
            })['finally'](function() {
                self.inprocess = false;
            });

            return deferred.promise;
        };


        return ApiHandler;

    }]);
})(angular, jQuery);
