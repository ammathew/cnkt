angular.module('stripe', []).directive('stripeForm', ['$window',
function($window) {

  var directive = { restrict: 'A' };
  directive.link = function(scope, element, attributes) {
    var form = angular.element(element);
    form.bind('submit', function() {
      var button = form.find('button');
      button.prop('disabled', true);
      $window.Stripe.createToken(form[0], function() {
        button.prop('disabled', false);
        var args = arguments;
        scope.$apply(function() {
          scope[attributes.stripeForm].apply(scope, args);
        });
      });
    });
  };
  return directive;

}]);

aa = angular.module('myServiceModule', [ 'nvd3ChartDirectives', 'ngRoute', 'stripe' ]);

aa.config(['$interpolateProvider', '$routeProvider', '$locationProvider', function ($interpolateProvider, $routeProvider, $locationProvider) {

    $routeProvider
	.when('/register',{
            templateUrl: 'register.html',
            controller: 'AuthCtrl'
        })
	.when('/',{   
            templateUrl: 'login.html',
            controller: 'AuthCtrl'
        })
	.when('/pay',{   
            templateUrl: 'pay.html',
            controller: 'PayCtrl'
        })
	.when('/dashboard',{
            templateUrl: 'dashboard.html',
            controller: 'DashboardCtrl'
        }); 

   // $locationProvider.html5Mode( false );
    // was not able to get html5Mode to work. maybe look into History.js .. 
}]);


aa.controller('AuthCtrl', ['$scope', 'searchTwitterFactory', '$http', '$location', '$window', 'twitter', '$rootScope', function ($scope, searchTwitterFactory, $http, $location, $window, twitter, $rootScope ) {

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
	    $scope.login( true )
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

    $scope.loggedIn = false;
  
    $scope.login = function( firstTime ) {
        var data = {}
        data.email = $scope.email;
        data.password = $scope.password;
        $http({ 
            method: 'POST',
	    url:"/api/login",
            data: $.param(data),
            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        }).success( function( data ) {
            console.log( data );
            $location.path("/dashboard");
	    if ( firstTime ) {
		$rootScope.authTwitter();
	    }
	    $scope.loggedIn = true;
	//    $rootScope.loggedInUser = data
        });
    }
    console.log(   $rootScope.loggedInUser )

}])

aa.controller('DashboardCtrl', ['$scope', 'searchTwitterFactory', '$http', '$location','$window', 'twitter', '$rootScope', function ($scope, searchTwitterFactory, $http, $location, $window, twitter, $rootScope ) {

    $scope.saveCustomer = function(status, response) {
	$http.post('/api/stripe/createCustomer', { token: response.id });
    };

    $scope.conversations = [];
    $scope.showResponseInput = false;
    $scope.resetData = function() {
	$scope.conversations = []
	$scope.posts = []
    }
    $scope.count = 140;
    $scope.resetData();

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
    
    $scope.postStatus = function( newTweet ){
        $scope.refreshTimeline = true;
	options = {   
	    method: 'POST',
	    url: "/api/twitter/update_status",
	    data: { status : newTweet }
	}
	twitter( options ).success( function( data ) {
	    console.log( data )
            newTweet = "";
	});
    }

    $scope.favoritePost = function( tweet ) {
	options = {   
	    method: 'POST',
	    url: "/api/twitter/create_favorite",
	    data: { id : tweet.id_str }
	}
	return twitter( options )
    }

    $scope.retweetPost = function( tweet ) {
	options = {   
	    method: 'POST',
	    url: "/api/twitter/retweet",
	    data: { id : tweet.id_str }
	}
	return twitter( options )
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
    
    /* extract special words/phrases from post text */

    $scope.getTweetEnts = function ( tweetText ) {
	$scope.getEntities( tweetText ).success( function( data ) {
            $scope.keywords = data;  
        });
    } 

    $scope.$watch( 'selectedText', function( newValue ) {
	$( ".col-body button" ).click( function() {
	    $scope.$apply( function(){
		$scope.loading_tweets = true;
		$scope.searchTwitter( newValue ).success( function( data ){
		    $scope.tweetsWithSearchTerm = data.statuses;
		    $scope.loading_tweets = false;
		}); 
	    })
	})
	
    })

   // $scope.getHighlightedText();
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
        $scope.refreshTimeline = false;
        $scope.$apply();
    }

    
    $scope.getPosts();
    $scope.getConvos();

    $scope.twitterAuthed = false;

    $rootScope.authTwitter = function() {
        $http({ 
            method: 'GET',
	    url:"/api/authtwitter",
        }).success( function( data ) {
            console.log( data.redirect_url );  
            $window.location.href = data.redirect_url;
	    $scope.twitterAuthed = true;
        });
    }
/*
    $scope.$watch( 'twitterAuthed', function(){
	if ( $scope.twitterAuthed == true ) {
	    $scope.getPosts() 
	    $scope.twitterAuthed = false;
	}
    })
*/
    $scope.getStripeCustomerInfo = function() {
	$http({
	    method: 'GET',
	    url: "/api/stripe/getCustomerInfo"
	}).success( function( data ) {
	    $scope.stripeCustomerInfo = data
	});
    }
     $scope.getStripeCustomerInfo()
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

aa.directive( 'countChars', function() {
    return {
	restrict: 'A',
	scope: true,
	link: function( scope, elem, attrs ) {
	    scope.count = 140
	    model = elem.find( 'input, textarea' ).attr('ng-model')
	    scope.$watch( model, function(newValue) {
		if (newValue) {
		    scope.count = newValue.length
		    var urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
		    var matchUrls = newValue.match( urlRegex )
		    if ( matchUrls ) {
			console.log( matchUrls )
			for( i=0; i<matchUrls.length; i++ ) {
			    var aa = matchUrls[i].length 
			    scope.count = scope.count - aa
			}
			scope.count =  scope.count + (matchUrls.length * 23)	
		    }
		}
		scope.count = 140 - scope.count
	    })
        }
    }	
})

aa.directive( 'animateOnSend', function() {
    return {
	scope: true,
	link: function( scope,elem, attr ) {
	    scope.replied = false;
	    elem.find( 'button' ).on( 'click', function() {           
		elem.addClass( "animated" );
		elem.addClass( "bounceOutRight" )
		console.log( "reply to post" )
		elem.parent(".tweet-unit").css( "height", "0" );
		scope.$apply();

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

aa.directive( 'cnktCol', function() {
    return {
	restrict: 'A',
	link: function( scope, elem, attr ) {
	    scope.showControls = false;
	    elem.find(".toggle-control").on( 'click', function() {
		scope.showControls = !scope.showControls
		scope.$apply()
		console.log( scope.showControls )
	    })
	    scope.$watch( 'showControls', function( newValue ) {
		elem.find( ".col-body").height( '100%')
		if ( newValue == true ){
		    var controlsHeight = elem.find(".col-controls").height()
		    console.log( controlsHeight )
		    var currentColBodyHeight = elem.find(".col-body").height()
		    elem.find(".col-body").height( currentColBodyHeight - controlsHeight - 40 )
		}
	    })

	   // scope.$watch( 'showCompose', function() {
//		if ( showCompose == true ) {
//		    console.log( elem.find( 'col-controls').height() )
//		}
	    //})
	}
    }
});

aa.directive( 'tweetStat', function() {
    return {
        scope: true,
        link: function( scope, elem, attrs ) {
            scope.actionTaken = false;
            var statMap = { 
                retweet: { 
                    f: scope.retweetPost,
                    countParam: 'retweet_count'
                },
                favorite: {
                    f: scope.favoritePost,
                    countParam: 'favorite_count'
                }
            }
            scope.statcount = scope.tweet[ statMap[attrs.tweetStat]['countParam'] ];
            elem.on( 'click', function() {
                var f =  statMap[attrs.tweetStat]['f']
                f( scope.tweet ).success( function() {
                    scope.statcount = scope.statcount + 1;
                    scope.actionTaken = true
                })               
            })
        }
    }
}) 

aa.directive( 'highlightSearch', function() {
    var linker = function( scope, elem, attr ) {
	console.log( scope )
	elem.mouseup(function (e){
	    var text = "";
	    if (window.getSelection ) {
		if ( $( window.getSelection().focusNode.parentNode ).parents(".col-body") ) {
		    var testString = window.getSelection()+'';
		    if ( testString.length > 0 ) {
			scope.$apply( function() {
			    $(".search-term").contents().unwrap();
			    $(".search-term").remove();
			    scope.selectedText = window.getSelection().toString();
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
		    scope.searchText = document.selection.createRange().text;
		    scope.$apply()
		}
	    }
	});
    }
    return {
	restrict: 'A',
	link: linker
    }
})



aa.config(function() {
  Stripe.setPublishableKey('pk_test_IN2jd8C7BtBsoH7F4589mFyH');
})



