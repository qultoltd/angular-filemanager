(function(angular, $) {
    'use strict';
    angular.module('FileManagerApp').controller('FileManagerCtrl', [
        '$scope', '$rootScope', '$window', '$translate', '$location', '$interval', '$filter', 'fileManagerConfig', 'item', 'fileNavigator', 'apiMiddleware',
        function($scope, $rootScope, $window, $translate, $location, $interval, $filter, fileManagerConfig, Item, FileNavigator, ApiMiddleware) {

        var $storage = $window.localStorage;
        $scope.config = fileManagerConfig;
        $scope.reverse = false;
        $scope.predicate = ['model.type', 'model.name'];
        $scope.order = function(predicate) {
            $scope.reverse = ($scope.predicate[1] === predicate) ? !$scope.reverse : false;
            $scope.predicate[1] = predicate;
        };
        $scope.query = '';
        $scope.fileNavigator = new FileNavigator();
        $scope.apiMiddleware = new ApiMiddleware();
        $scope.uploadFileList = [];
        $scope.viewTemplate = $storage.getItem('viewTemplate') || 'main-icons.html';
        $scope.fileList = [];
        $scope.temps = [];
        $scope.clickedCancelReportButtons = new Set();
        $scope.currentFolder = {};

        $scope.$watch('temps', function() {
            if ($scope.singleSelection()) {
                $scope.temp = $scope.singleSelection();
                $scope.isReportOpen = true;
                $scope.isDescriptionOpen = true;
                if ($scope.temps[0].model.path && $scope.temps[0].model.type === 'file' && $scope.temps[0].model.processingStatus === 'processed') {
                  //TODO: option to turn this off
                  $scope.listReports();
                }
            } else {
                $scope.temp = new Item({rights: 644});
                $scope.temp.multiple = true;
            }
            $scope.temp.revert();
        });

        $scope.fileNavigator.onRefresh = function() {
            $scope.temps = [];
            $scope.query = '';
            $rootScope.selectedModalPath = $scope.fileNavigator.currentPath;
          /*  var pathString = $rootScope.selectedModalPath.join('/')
            $location.search({'path': pathString});*/
        };

        $scope.setTemplate = function(name) {
            $storage.setItem('viewTemplate', name);
            $scope.viewTemplate = name;
        };

        $scope.changeLanguage = function (locale) {
            if (locale) {
                $storage.setItem('language', locale);
                return $translate.use(locale);
            }
            $translate.use($storage.getItem('language') || fileManagerConfig.defaultLang);
        };

        $scope.isSelected = function(item) {
            return $scope.temps.indexOf(item) !== -1;
        };

        $scope.selectOrUnselect = function(item, $event) {
            var indexInTemp = $scope.temps.indexOf(item);
            var isRightClick = $event && $event.which == 3;

            if ($event && $event.target.hasAttribute('prevent')) {
                $scope.temps = [];
                return;
            }
            if (! item || (isRightClick && $scope.isSelected(item))) {
                return;
            }
            if ($event && $event.shiftKey && !isRightClick) {
                var list = $scope.fileList;
                var indexInList = list.indexOf(item);
                var lastSelected = $scope.temps[0];
                var i = list.indexOf(lastSelected);
                var current = undefined;
                if (lastSelected && list.indexOf(lastSelected) < indexInList) {
                    $scope.temps = [];
                    while (i <= indexInList) {
                        current = list[i];
                        !$scope.isSelected(current) && $scope.temps.push(current);
                        i++;
                    }
                    return;
                }
                if (lastSelected && list.indexOf(lastSelected) > indexInList) {
                    $scope.temps = [];
                    while (i >= indexInList) {
                        current = list[i];
                        !$scope.isSelected(current) && $scope.temps.push(current);
                        i--;
                    }
                    return;
                }
            }
            if ($event && !isRightClick && ($event.ctrlKey || $event.metaKey)) {
                $scope.isSelected(item) ? $scope.temps.splice(indexInTemp, 1) : $scope.temps.push(item);
                return;
            }
            $scope.temps = [item];
        };

        $scope.singleSelection = function() {
            return $scope.temps.length === 1 && $scope.temps[0];
        };

        $scope.totalSelecteds = function() {
            return {
                total: $scope.temps.length
            };
        };

        $scope.selectionHas = function(type) {
            return $scope.temps.find(function(item) {
                return item && item.model.type === type;
            });
        };

        $scope.selectionHasOtherStatusThan = function(status) {
            return $scope.temps.find(function(item) {
                return item && item.model.processingStatus !== status;
            });
        };

        $scope.prepareNewFolder = function() {
            var item = new Item(null, $scope.fileNavigator.currentPath);
            $scope.temps = [item];
            return item;
        };

        $scope.goTo = function(key) {
          if((key === 0 && $scope.fileNavigator.currentPath[0] === 'user') || (key === 1 && $scope.fileNavigator.currentPath[0] === 'organizations')) {
            $scope.currentFolder.sectionLength = 200;
          }
          $scope.fileNavigator.goTo(key);
        }

        $scope.smartClick = function(item) {
          $scope.currentFolder.sectionLength = item.model.maxSectionLength;
          if ($scope.currentFolder.sectionLength == 0) {
            $scope.currentFolder.sectionLength = 200;
          }
            var pick = $scope.config.allowedActions.pickFiles;
            if (item.isFolder()) {
                return $scope.fileNavigator.folderClick(item);
            }

            if (typeof $scope.config.pickCallback === 'function' && pick) {
                var callbackSuccess = $scope.config.pickCallback(item.model);
                if (callbackSuccess === true) {
                    return;
                }
            }

            if (item.isImage()) {
                if ($scope.config.previewImagesInModal) {
                    return $scope.openImagePreview(item);
                }
                return $scope.apiMiddleware.download(item, true);
            }

            // if (item.isEditable()) {
            //     return $scope.openEditItem(item);
            // }
        };

        $scope.openImagePreview = function() {
            var item = $scope.singleSelection();
            $scope.apiMiddleware.apiHandler.inprocess = true;
            $scope.modal('imagepreview', null, true)
                .find('#imagepreview-target')
                .attr('src', $scope.apiMiddleware.getUrl(item))
                .unbind('load error')
                .on('load error', function() {
                    $scope.apiMiddleware.apiHandler.inprocess = false;
                    $scope.$apply();
                });
        };

        $scope.openEditItem = function() {
            var item = $scope.singleSelection();
            $scope.apiMiddleware.getContent(item).then(function(data) {
                item.tempModel.content = item.model.content = data.result;
            });
            $scope.modal('edit');
        };

        $scope.modal = function(id, hide, returnElement) {
          if(id === 'remove' && !hide) {
            $scope.apiMiddleware.checkBeforeRemove($scope.temps).then(function(response) {
                $scope.removePreviewResult = response;
                var element = $('#' + id);
                element.modal('show');
                $scope.apiMiddleware.apiHandler.error = '';
                $scope.apiMiddleware.apiHandler.asyncSuccess = false;
                return returnElement ? element : true;
            });
          } else {
            if(id === 'startreportgeneration' && !hide) {
              $scope.report = { reportName: $scope.singleSelection().model.name + ' - ' + $filter('date')(new Date(), 'yyyy-MM-dd HH:mm:ss'), reportSettings: {} };
            } else if(id === 'startbatchreportgeneration' && !hide) {
              $scope.report = { reportSettings: {} };
            }
            var element = $('#' + id);
            element.modal(hide ? 'hide' : 'show');
            $scope.apiMiddleware.apiHandler.error = '';
            $scope.apiMiddleware.apiHandler.asyncSuccess = false;
            return returnElement ? element : true;
          }
        };

        $scope.modalWithPathSelector = function(id) {
            $rootScope.selectedModalPath = $scope.fileNavigator.currentPath;
            return $scope.modal(id);
        };

        $scope.isInThisPath = function(path) {
            var currentPath = $scope.fileNavigator.currentPath.join('/') + '/';
            return currentPath.indexOf(path + '/') !== -1;
        };

        $scope.edit = function() {
            $scope.apiMiddleware.edit($scope.singleSelection()).then(function() {
                $scope.modal('edit', true);
            });
        };

        $scope.changePermissions = function() {
            $scope.apiMiddleware.changePermissions($scope.temps, $scope.temp).then(function() {
                $scope.modal('changepermissions', true);
            });
        };

        $scope.download = function() {
            var item = $scope.singleSelection();
            if ($scope.selectionHas('dir')) {
                return;
            }
            if (item) {
                return $scope.apiMiddleware.download(item);
            }
            return $scope.apiMiddleware.downloadMultiple($scope.temps);
        };

        $scope.copy = function() {
            var item = $scope.singleSelection();
            if (item) {
                var name = item.tempModel.name.trim();
                var nameExists = $scope.fileNavigator.fileNameExists(name);
                if (!name) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                    return false;
                } else if (nameExists && validateSamePath(item)) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_existing_filename');
                    return false;
                }
            }
            $scope.apiMiddleware.copy($scope.temps, $rootScope.selectedModalPath).then(function() {
                $scope.fileNavigator.refresh();
                $scope.modal('copy', true);
            });
        };

        $scope.compress = function() {
            var name = $scope.temp.tempModel.name.trim();
            var nameExists = $scope.fileNavigator.fileNameExists(name);

            if (!name) {
                $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                return false;
            } else if (nameExists && validateSamePath($scope.temp)) {
                $scope.apiMiddleware.apiHandler.error = $translate.instant('error_existing_filename');
                return false;
            }

            $scope.apiMiddleware.compress($scope.temps, name, $rootScope.selectedModalPath).then(function() {
                $scope.fileNavigator.refresh();
                if (! $scope.config.compressAsync) {
                    return $scope.modal('compress', true);
                }
                $scope.apiMiddleware.apiHandler.asyncSuccess = true;
            }, function() {
                $scope.apiMiddleware.apiHandler.asyncSuccess = false;
            });
        };

        $scope.extract = function() {
            var item = $scope.temp;
            var name = $scope.temp.tempModel.name.trim();
            var nameExists = $scope.fileNavigator.fileNameExists(name);

            if (!name) {
                $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                return false;
            } else if (nameExists && validateSamePath($scope.temp)) {
                $scope.apiMiddleware.apiHandler.error = $translate.instant('error_existing_filename');
                return false;
            }

            $scope.apiMiddleware.extract(item, name, $rootScope.selectedModalPath).then(function() {
                $scope.fileNavigator.refresh();
                if (! $scope.config.extractAsync) {
                    return $scope.modal('extract', true);
                }
                $scope.apiMiddleware.apiHandler.asyncSuccess = true;
            }, function() {
                $scope.apiMiddleware.apiHandler.asyncSuccess = false;
            });
        };

        $scope.remove = function() {
            $scope.apiMiddleware.remove($scope.temps).then(function() {
                $scope.fileNavigator.refresh();
                $scope.modal('remove', true);
            });
        };

        $scope.move = function() {
            var anyItem = $scope.singleSelection() || $scope.temps[0];
            if (anyItem && validateSamePath(anyItem)) {
                $scope.apiMiddleware.apiHandler.error = $translate.instant('error_cannot_move_same_path');
                return false;
            }
            $scope.apiMiddleware.move($scope.temps, $rootScope.selectedModalPath).then(function() {
                $scope.fileNavigator.refresh();
                $scope.modal('move', true);
            });
        };

        $scope.rename = function() {
            var item = $scope.singleSelection();
            var name = item.tempModel.name;
            var samePath = item.tempModel.path.join('') === item.model.path.join('');

            if (!name) {
                $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                return false;
            } else if (samePath && $scope.fileNavigator.fileNameExists(name)) {
              $scope.apiMiddleware.apiHandler.error = $translate.instant('error_existing_filename');
              return false;
            }

            $scope.apiMiddleware.rename(item).then(function() {
                $scope.fileNavigator.refresh();
                $scope.modal('rename', true);
            });
        };

        $scope.createFolder = function(sectionLength) {
            var item = $scope.singleSelection();
            item.tempModel.maxSectionLength = sectionLength;
            var name = item.tempModel.name;
            if (!name) {
              return $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
            } else if ($scope.fileNavigator.fileNameExists(name)) {
              return $scope.apiMiddleware.apiHandler.error = $translate.instant('error_creating_folder_already_exists');
            }
            $scope.apiMiddleware.createFolder(item).then(function() {
                $scope.fileNavigator.refresh();
                $scope.modal('newfolder', true);
            });
        };

        $scope.addForUpload = function($files) {
            $scope.uploadFileList = $scope.uploadFileList.concat($files);
            $scope.modal('uploadfile');
        };

        $scope.removeFromUpload = function(index) {
            $scope.uploadFileList.splice(index, 1);
        };

        $scope.uploadFiles = function() {
            for(var idx in $scope.fileNavigator.fileList){
                for(var id in $scope.uploadFileList){
                    if($scope.fileNavigator.fileList[idx].model.name ===  $scope.uploadFileList[id].name){
                        return $scope.apiMiddleware.apiHandler.error = $translate.instant('error_creating_folder_already_exists');
                    }
                }
            }
            $scope.apiMiddleware.upload($scope.uploadFileList, $scope.fileNavigator.currentPath).then(function() {
                
                $scope.fileNavigator.refresh();
                $scope.uploadFileList = [];
                $scope.modal('uploadfile', true);

            }, function(data) {
                
                // it's the error branch of the promise
                
                var errorMsg = $translate.instant('error_uploading_files');
                
                if (data && data.result && data.result.error) {
                  errorMsg = data.result.error;
                }
                
                if(data && data.result && data.result.status == 409) {
                  errorMsg = $translate.instant('error_uploading_files_file_already_exists');
                }

                if(data && data.code && data.code === 403) {
                  errorMsg = $translate.instant('error_uploading_files_wrong_destination');
                }

                $scope.apiMiddleware.apiHandler.error = errorMsg;
            });
        };

        $scope.emptyList = function(){
            $scope.uploadFileList = [];
            $('#uploadfile').modal('hide');
        }

        $scope.prepareReportGeneration = function() {
          $scope.modalFileNavigator = new FileNavigator();
          //$scope.modalFileNavigator.initCurrentPath($scope.fileNavigator.currentPath);
        }

        $scope.startReportGeneration = function(report) {
          $scope.reportStartSubmitted = true;
          if (!report.reportName) {
            $scope.apiMiddleware.apiHandler.error = $translate.instant('REPORT_GENERATION_MODAL.REPORT_NAME_IS_REQUIRED');
            return;
          } else if(!report.reportSettings.myFiles && !report.reportSettings.institutionFiles
            && !report.reportSettings.webResources) {
            $scope.apiMiddleware.apiHandler.error = $translate.instant('REPORT_GENERATION_MODAL.REPORT_TARGET_REQUIRED');
            return;
          }
          var path = $scope.temps[0].model.fullPath();
          var name = $scope.temps[0].model.name;

          report.filePath = path;
          report.fileName = name;
          
          report.includedCorpuses = [];
          for (var idx in $rootScope.reportDirFilters) {
            var fullPath = $rootScope.reportDirFilters[idx].model.fullPath();
            if (fullPath.startsWith('/user/')) {
              fullPath = 'user:' + $rootScope.activeUser.userId + ':' + encodeURIComponent(fullPath.split('/user/')[1]);
            } else if (fullPath.startsWith('/organizations/')) {
              var firstPart = fullPath.split('/').slice(2, 3)[0];
              var secondPart = encodeURIComponent(fullPath.split('/').slice(3).join('/'));

              fullPath = firstPart + ":" + secondPart;
            } else if (fullPath.startsWith('/web/')) {
              var parts = fullPath.split('/');
              var firstpart = parts[1] ? parts[1] + ":" : "";
              var secondPart = parts[2] ? parts[2] + ":" : "";
              var thirdPart = parts[3] ? parts[3] + ":" : "";
              fullPath = firstpart + secondPart + thirdPart;
            }
            report.includedCorpuses.push(fullPath);
          }
          $rootScope.reportDirFilters = [];

          $scope.apiMiddleware.startReportGeneration(report).then(function() {
              $scope.fileNavigator.refresh();
              $scope.modal('startreportgeneration', true);
          });
        };

        $scope.cancelReportGeneration = function(reportId, userId) {
          $scope.clickedCancelReportButtons.add(reportId);
          $scope.apiMiddleware.cancelReportGeneration(reportId, userId)
        };

        $scope.closeReportModal = function() {
          $rootScope.reportDirFilters = [];
        }

        $scope.startBatchReportGeneration = function(report) {
          $scope.batchReportStartSubmitted = true;
          if(!report.reportSettings.myFiles && !report.reportSettings.institutionFiles
            && !report.reportSettings.webResources) {
            $scope.apiMiddleware.apiHandler.error = $translate.instant('REPORT_GENERATION_MODAL.REPORT_TARGET_REQUIRED');
            return;
          }
          var list = [];
          angular.forEach($scope.temps, function(temp) {
            list.push({
              path: temp.model.fullPath(),
              name: temp.model.name
            })
          });
          report.selectedDocuments = list;

          $scope.apiMiddleware.startBatchReportGeneration(report).then(function() {
              $scope.fileNavigator.refresh();
              $scope.modal('startbatchreportgeneration', true);
          });
        };

        $scope.listReports = function() {
          
          if ($scope.temps[0].model.path && $scope.temps[0].model.type === 'file' 
                && $scope.temps[0].model.processingStatus === 'processed') {

            var path = $scope.temps[0].model.fullPath();

            $scope.apiMiddleware.listReports(path).then(function(response) {
              $scope.currentReports = response.result;
              $scope.isReportOpen = true;
              $scope.isDescriptionOpen = true;
              $scope.reportLimit = 2;
              $scope.isLimited = true;
                // $scope.fileNavigator.refresh();
            });
          }
        };

        $scope.getReportLimit = function() {
          return ($scope.isLimited || !$scope.currentReports) ? $scope.reportLimit: $scope.currentReports.length;
        };

        $scope.toggleFullReportList = function() {
          $scope.isLimited = !$scope.isLimited;
        };

        $scope.openReport = function(reportId) {
          saveNavigationIntoStorage(reportId);
          $location.path(fileManagerConfig.reportViewBasePath + reportId);
        };

        function saveNavigationIntoStorage(reportId){
          localStorage.setItem(reportId + "_fileList", JSON.stringify($scope.fileNavigator.fileList));
          localStorage.setItem(reportId + "_history",   JSON.stringify($scope.fileNavigator.history));
          localStorage.setItem(reportId + "_currentPath", JSON.stringify($scope.fileNavigator.currentPath));
        }

        $scope.shouldDescriptionBeOpen = function() {
          return $scope.temps.length == 1 && $scope.temps[0].model && $scope.temps[0].model.name;
        };

        $scope.allowActionsWithSingleSelection = function () {
            return $scope.temps.length === 1 && $scope.temps[0] && $scope.temps[0].model && $scope.temps[0].model.base != true;
        };

        $scope.allowActionsWithMultiSelection = function () {
            var returnValue = true;
            if($scope.temps.length > 1) {
                angular.forEach($scope.temps, function (temp){

                    if(temp.model && temp.model.base && temp.model.base == true) {
                        returnValue = false;
                    }
                });
            } else {
                return false;
            }
            return returnValue;
        };

        var validateSamePath = function(item) {
            var selectedPath = $rootScope.selectedModalPath.join('');
            var selectedItemsPath = item && item.model.path.join('');
            return selectedItemsPath === selectedPath;
        };

        var getQueryParam = function(param) {
            var found = $window.location.search.substr(1).split('&').filter(function(item) {
                return param === item.split('=')[0];
            });
            return found[0] && found[0].split('=')[1] || undefined;
        };

        $scope.changeLanguage(getQueryParam('lang'));
        $scope.isWindows = getQueryParam('server') === 'Windows';

        /*if($location.search() && $location.search().path) {

          var pathValue = $location.search().path;
          var params = pathValue.split("/");


          if(typeof $location.search().path === 'string') {
            params.push($location.search().path);
          } else {
            params = $location.search().path;
          }
          $scope.fileNavigator.initCurrentPath(params);
        }*/

        $scope.fileNavigator.refresh();

        $scope.refreshList = function() {
          $scope.fileNavigator.refresh();
        }

        $scope.getClassForScore = function(score) {
          var classForScore = 'badge ';
          if (score < 0.25) {
            classForScore = classForScore + 'low';
          } else if (score < 0.5) {
            classForScore = classForScore + 'medium';
          } else if (score < 0.75) {
            classForScore = classForScore + 'high';
          } else if (score <= 1.0) {
            classForScore = classForScore + 'very-high';
          }
          return classForScore;
        }

        $scope.update = $interval(function () {
            $scope.fileNavigator.updateStatus();
            if ($scope.singleSelection()) {
              
              if ($scope.temps[0].model.path && $scope.temps[0].model.type === 'file' 
                && $scope.temps[0].model.processingStatus === 'processed') {
                //TODO: option to turn this off
                $scope.listReports();
              }              
              //$scope.listReports();
            }   
        }, 10000);

        $scope.stopUpdate = function() {
          if (angular.isDefined($scope.update)) {
            $interval.cancel($scope.update);
            $scope.update = undefined;
          }
        }

        $scope.translateDirName = function(dirName) {
          var item = findItemInHistory(dirName, $scope.fileNavigator.history);
          if (!item) {
            return dirName;
          }
          return $scope.translateItem(item);
        }

        function findItemInHistory(dirName, historyObject) {
          var item;
          for(var o in historyObject) {
            if(item != undefined) {
              break;
            }
            var currentNode = historyObject[o];
            if (currentNode.name.split('/').pop() === dirName) {
              item = currentNode.item;
            } else if(currentNode.nodes && currentNode.nodes.length > 0) {
              item = findItemInHistory(dirName, currentNode.nodes);
            }
          }
          return item;
        }

        $scope.translateItem = function(item) {

          if(!item || !item.model || !item.model.name) {
            return;
          }
          if(!item.model.base) {
            return item.model.name;
          }
          if(item.model.name) {
            var nameToTranslate = item.model.name;
            if(nameToTranslate.indexOf(':') > -1) {
              var endIndex = nameToTranslate.indexOf(':');
              nameToTranslate = nameToTranslate.substring(0, endIndex);
            }
            var result = $translate.instant(nameToTranslate, item.model.nameVariables);
            return result;
          }
        }

        $scope.$on('$destroy', function() {
          // Make sure that the interval is destroyed too
          $scope.stopUpdate();
        });

        // $interval(function(){ $scope.refreshList() }, 5000);

    }]);
})(angular, jQuery);
