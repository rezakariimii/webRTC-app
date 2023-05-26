(function () {
    "use strict";
    angular.module("app").controller("lobbyController", lobbyController);
  
    lobbyController.$inject = ["$scope", "$location"];
    function lobbyController($scope, $location) {
      $scope.submitLobby = function (e) {
        // e.preventDefault();
        let inviteCode = $scope.inviteLink;
        $location.path("/videocall").search({ room: inviteCode });
      };
    }
  })();