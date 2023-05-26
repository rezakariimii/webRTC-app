(function () {
  "use strict";
  angular.module("app").config(RoutesConfig);
  RoutesConfig.$inject = ["$stateProvider", "$urlRouterProvider"];
  function RoutesConfig($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise("/");
    $stateProvider
      .state("home", {
        url: "/",
        templateUrl: "src/templates/home.template.html",
      })
      .state("login", {
        url: "/login",
        templateUrl: "src/templates/login.template.html",
        controller: "loginController",
      })
      .state("lobby", {
        url: "/lobby",
        templateUrl: "src/templates/lobby.template.html",
        controller: "lobbyController",
      })
      .state("videocall", {
        url: "/videocall",
        templateUrl: "src/templates/videocall.template.html",
        controller: "videocallController",
      });
  }
})();
