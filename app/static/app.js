aa = angular.module('myServiceModule', [ 'nvd3ChartDirectives', 'ngRoute' ]);

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
	    q : "\"" + searchTerm + "\"", 
	    count:100,
	    lang: 'en'
	    
	};
        return $http({ 
            method: 'POST',
	    data: data,
	    url:"/api/twitter/search",
        })
    }

    $scope.favoritePost = function( tweet ) {
	options = {   
	    method: 'POST',
	    url: "/api/twitter/create_favorite",
	    data: { id : tweet.id_str }
	}
	twitter( options ).success( function() {
	    tweet.favorite_count = tweet.favorite_count + 1
	    tweet.user_favorited = true;
	});
    }

    $scope.replyToPost = function( tweet, response ) {
	$scope.refreshConvos = true;
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
	$scope.refreshConvos = false;
	$scope.loading_conversations = true;
	twitter( options ).success( function( data ) {
	    $scope.conversations =  data;
	    console.log( $scope.conversations );
	    $scope.loading_conversations = false;	
	})
    }
    
    $scope.getConvos();

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
	    if (window.getSelection ) {
		if ( $( window.getSelection().focusNode.parentNode ).parents(".cnkt-col").is("#user_tweets") ) {
		    var testString = window.getSelection()+'';
		    if ( testString.length > 0 ) {
			$scope.$apply( function() {
			    $(".search-term").contents().unwrap();
			    $(".search-term").remove();
			    $scope.selectedText = window.getSelection().toString();
			    var selection = window.getSelection();
			    console.log( selection );
			    var range = selection.getRangeAt(0);
			    var newNode = document.createElement("button");
			    newNode.classList.add( "search-term")
			    newNode.classList.add( "btn" );
			    newNode.classList.add( "btn-primary" );
			    range.surroundContents(newNode);
			})
		    }
		} else if (document.selection && document.selection.type != "Control") {
		    $scope.searchText = document.selection.createRange().text;
		}
	    }
	});
    }	

    $scope.$watch( 'selectedText', function( newValue ) {
	$( "button" ).click( function() {
	    $scope.$apply( function(){
		$scope.loading_tweets = true;
		$scope.searchTwitter( newValue ).success( function( data ){
		    $scope.tweetsWithSearchTerm = data.statuses;
		    $scope.loading_tweets = false;
		}); 
	    })
	})
	
    })

    $scope.getHighlightedText();
    $scope.twitterUser = {}
    $scope.getPosts = function () {
          $http({ 
              method: 'POST',
	      data: { count: 100, 
		      exclude_replies: true, 
		      include_rts: false
		    },
	      url:"/api/twitter/user_timeline",
        }).success( function( data, status ) {
	    if ( status == 200 ){
		$scope.posts = data;
		console.log( $scope.posts );
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

aa.directive( 'animateOnSend', function() {
    return {
	scope: true,
	link: function( scope,elem, attr ) {
	    scope.replied = false;
	    elem.find( 'button' ).on( 'click', function() {
		scope.replyToPost( scope.tweet, scope.currentResponse );
		elem.addClass( "animated" );
		elem.addClass( "bounceOutRight" )
		console.log( "reply to post" )
		elem.parent(".tweet-unit").css( "height", "0" );
		scope.$apply;

		/* in case replying to a tweet in an existing conversationalready replied to ... unlikely
		   _.each( scope.conversations, function( convo ) { 
		   _.each( convo, function( twt, index) { 
		   console.log( twt )
		   
		   if ( twt.id_str == scope.tweet.id_str ) {
		   console.log( "this is index" );
		   console.log( index );
		   }
		   });   
		   });
		*/

	    });		 
	}
    }
})


aa.run(function($rootScope, $templateCache) {
   $rootScope.$on('$viewContentLoaded', function() {
      $templateCache.removeAll();
   });
});


aa.directive('autolinker', function () {
    return {
	restrict: 'A',
	scope: {
	    text: '='
	},
	link: function (scope, element, attrs) {
	    scope.$watch("text", function (new_value) {
		if (new_value != undefined) {
		    element.html(Autolinker.link(new_value, {email: false, twitter: false}));
		}
	    })
	}
    }
})
