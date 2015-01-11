aa = angular.module('myServiceModule', ['ui.bootstrap', 'nvd3ChartDirectives', 'ngRoute' ]);

aa.config(['$interpolateProvider', '$routeProvider', '$locationProvider', function ($interpolateProvider, $routeProvider, $locationProvider ) {

    $routeProvider
	.when('/register',{
            templateUrl: 'register.html',
            controller: 'AuthCtrl'
        })
	.when('/',{
            templateUrl: 'login.html',
            controller: 'AuthCtrl'
        })
	.when('/dashboard',{
            templateUrl: 'dashboard.html',
            controller: 'DashboardCtrl'
        }); 

   // $locationProvider.html5Mode( false );
    // was not able to get html5Mode to work. maybe look into History.js .. 
}]);

aa.controller('DashboardCtrl', ['$scope', 'searchTwitterFactory', '$http', '$location', '$rootScope', '$window', 'twitter', function ($scope, searchTwitterFactory, $http, $location, $rootScope, $window, twitter ) {
    
    $scope.showResponseInput = false;
    
    $scope.resetData = function() {
	$scope.conversations = []
	$scope.posts = []
    }
    
    $scope.resetData;

    /* calls to tweepy/twitter API */

    $scope.searchTwitter = function ( searchTerm ) {
	data = { 
	    q : searchTerm, 
	    count:100
	};
        return $http({ 
            method: 'POST',
	    data: data,
	    url:"/api/twitter/search",
        })
    }

    $scope.favoritePost = function( id_str ) {
	options = {   
	    method: 'POST',
	    url: "/api/twitter/create_favorite",
	    data: { id : id_str }
	}
	twitter( options );
    }

    $scope.replyToPost = function( tweet, response ) {
	options = {   
	    method: 'POST',
	    url: "/api/twitter/update_status",
	    data: { 
		status: '@' + tweet.user.screen_name + ' ' + response,
		in_reply_to_status_id : tweet.id_str 
	    }
	}
	twitter( options );
    }

    /* construct conversations from multiple api endpoints */

    $scope.getConvos = function() {
	options = {   method: 'POST',
		      url: "/api/twitter/convos"
		  }
	return twitter( options );
    }

    $scope.getConvos().success( function( data ) {
	$scope.conversations =  data;
	console.log( $scope.conversations );
    });


    /* extract special words/phrases from post text */

    $scope.getTweetEnts = function ( tweetText ) {
	$scope.getEntities( tweetText ).success( function( data ) {
            $scope.keywords = data;  
        });
    } 

    $scope.getEntities = function ( text ) {
	data = { text: text } 
        return $http({ 
            method: 'POST',
	    headers: {
		"Content-Type": "application/json"
	    },
	   data: data,
	    url:"/api/extractEnts",
        })
    }

    /* search from highlighted text */

    $scope.getHighlightedText = function() {
	$('html').mouseup(function (e){
	    var text = "";
	    if (window.getSelection && window.getSelection().type == "Range" ) {
		$scope.$apply( function() {
		    $("mark").contents().unwrap();
		    $("mark").remove();
		    $scope.selectedText = window.getSelection().toString();
		    var selection = window.getSelection();
		    var range = selection.getRangeAt(0);
		    var cssclass = $(selection.anchorNode.parentNode).attr("class");
		    var newNode = document.createElement("mark");
		    range.surroundContents(newNode);
		})

	    } else if (document.selection && document.selection.type != "Control") {
		$scope.searchText = document.selection.createRange().text;
	    }
	});
    }	

    $scope.$watch( 'selectedText', function( newValue ) {
	$( "mark" ).click( function() {
	    $scope.$apply( function(){
		$scope.searchTwitter( newValue ).success( function( data ){
		    $scope.tweetsWithSearchTerm = data.statuses;
		}); 
	    })
	})
	
    })

    $scope.getHighlightedText();

/* 
    $scope.$watch( 'posts', function( newValue ) {
	$scope.allPosts = '';

	if( newValue ) {
	    for( i=0; i< $scope.posts.length; i++ ) {
		console.log( $scope.posts );
		$scope.allPosts = $scope.allPosts + '. ' + $scope.posts[i].text;
	    }
	    console.log( 'get entities' );
	    $scope.getEntities( $scope.allPosts ).success( function(data) {
		$scope.entities = data;	
	    });
	}
	console.log( $scope.allPosts );
	
    })
*/

    $scope.twitterUser = {}
    $scope.getPosts = function () {
          $http({ 
              method: 'POST',
	      data: { count: 100, 
		      exclude_replies: true, 
		      incude_rts: false
		    },
	      url:"/api/twitter/user_timeline",
        }).success( function( data, status ) {
	    if ( status == 200 ){
		$scope.posts = data;
		$scope.twitterUser = data[0].user
	    }
        })
    }

    $scope.getPosts();

    $scope.twitterAuthed = false;

    $scope.authTwitter = function() {
        $http({ 
            method: 'GET',
	    url:"/api/authtwitter",
        }).success( function( data ) {
            console.log( data.redirect_url );  
            $window.location.href = data.redirect_url;
	    $scope.twitterAuthed = true;
        });
    }

    $scope.$watch( 'twitterAuthed', function(){
	if ( $scope.twitterAuthed == true ) {
	    $scope.getPosts() 
	    $scope.twitterAuthed = false;
	}
    })
  
}]);
  
aa.factory('searchTwitterFactory', function($http) {
    return function( companyName, geodata ) {
	return $http({
	    method: 'GET',
            url: '/api/company-info',
	    params : { 
		search_term : companyName,
		geocode: geodata
	    }
	});    
    }
});


aa.directive( 'sentchart', function() {
    return {
	restrict: 'E',
	link: function( scope, elem, attr ) {
	    scope.$watch( 'timeAndSent', function(newValue, attr) {
		if ( newValue ) {
		    data = newValue;
		    arr = [];
		    for( i=0; i<data.length; i++ ) {
			obj ={};
			obj['x'] = i;
			obj['y'] = parseInt( data[i].pos * 100 );
			arr.push( obj );
		    }

		    console.log( arr );

		    var graph = new Rickshaw.Graph( {
			element: document.querySelector("#chart"), 
			width: 300, 
			height: 200, 
			series: [{
			    color: 'steelblue',
			    data: arr
			}]
		    });		
		    graph.render();
		}
	    });
	}	
    }
})

aa.controller('AuthCtrl', ['$scope', '$http', '$location',  function ($scope, $http, $location ) {
    
    $scope.signup = function(){ 
        var data = {}
        data.username = $scope.username;
        data.password = $scope.password;
        data.email = $scope.email;
        $http({ 
            method: 'POST',
	    url:"/api/register",
            data: $.param(data),
            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        }).success( function( data ) {
            console.log( data );  
        });
    };

    $scope.logOut = function () {
        $http({ 
            method: 'GET',
	    url:"/api/logout",
        }).success( function( data ) {
            $scope.resetData();
            console.log( data );  
            $location.path( "/" );
        });
    }
  
    $scope.login = function() {
        var data = {}
        data.username = $scope.username;
        data.password = $scope.password;
        $http({ 
            method: 'POST',
	    url:"/api/login",
            data: $.param(data),
            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        }).success( function( data ) {
            console.log( data );
            $location.path("/dashboard");
        });
    }
}])

aa.service( 'twitter', function( $http ){
    return function( id_str ) {
	console.log( options );
	return $http( options )
    }
});

aa.directive( 'mark', function() {
    return {
	restrict: 'E',
	link: function( scope, elem, attrs ) {
	    console.log( 'mark...yo' );
	    elem.bind( "click", function() {
		scope.searchTwitter( newValue ).success( function( data ){
		    scope.tweetsWithSearchTerm = data.statuses;
		}); 
	    });
	}
    }
});

aa.directive( 'reservation', function() {
    return {
	restrict: 'A',
	link: function( scope, elem, attr ) {
	    elem.daterangepicker(null, function(start, end, label) {
                scope.start = start.toISOString();
		scope.end = end.toISOString();
            });
	}	
    }
})


aa.run(function($rootScope, $templateCache) {
   $rootScope.$on('$viewContentLoaded', function() {
      $templateCache.removeAll();
   });
});
