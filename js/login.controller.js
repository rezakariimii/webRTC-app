(function () {
  "use strict";
  angular.module("app").controller("loginController", loginController);

  loginController.$inject = ["$scope", "$location", "$rootScope"];
  function loginController($scope, $location, $rootScope) {
    $scope.submitForm = function () {
      // Store form data in local storage
      $rootScope.name = $scope.formData.name;
      $rootScope.password = $scope.formData.password;    

      // Navigate to the next page
      $location.path("/lobby");
    };
  }
})();
