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

aa = angular.module('myServiceModule', [ 'ngRoute', 'stripe' ]);

aa.config(['$interpolateProvider', '$routeProvider', '$locationProvider', function ($interpolateProvider, $routeProvider, $locationProvider) {

    $routeProvider
	.when('/register',{
            templateUrl: 'register.html',
            controller: 'AuthCtrl'
        })
	.when('/',{   
            templateUrl: 'marketing.html',
            controller: 'AuthCtrl'
        })
	.when('/login',{   
            templateUrl: 'login.html',
            controller: 'AuthCtrl'
        })
	.when('/forgot-password',{  
            templateUrl: 'forgot-password.html',
            controller: 'AuthCtrl'
        })
	.when('/reset-forgot-password',{   
            templateUrl: 'reset-forgot-password.html',
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


aa.controller('AuthCtrl', ['$scope', 'searchTwitterFactory', '$http', '$location', '$window', 'twitter', '$rootScope', '$timeout',  function ($scope, searchTwitterFactory, $http, $location, $window, twitter, $rootScope, $timeout ) {

    $scope.registerPage = function() {
	$location.path( '/register' )
    };
    $scope.loginPage = function() {
	$location.path( '/login' )
    };

    if( $location.absUrl().split('/')[4] && $location.absUrl().split('/')[4] == 'reset' ) {
	$location.path( '/reset-forgot-password' )
    }


    $rootScope.authTwitter = function() {
        $http({ 
            method: 'GET',
	    url:"/api/authtwitter",
        }).success( function( data ) {
            $window.location.href = data.redirect_url;

	    $scope.twitterAuthed = true;
        });
    }

    $rootScope.isFirstLogin = false;
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
	    if ( data.status == 401 ) {
		$scope.error_text = data.message;
	    } else {
		$rootScope.isFirstLogin = true;
		$scope.login()
	    }
        });
    };

    $scope.logOut = function () {
        $http({ 
            method: 'GET',
	    url:"/api/logout",
        }).success( function( data ) {
            $scope.resetData();
            $location.path( "/" );
        });
    }

    $scope.sendResetEmail = function () {
        $http({ 
            method: 'POST',
            params: { email: $scope.email_to_reset } ,
	    url:"/reset",
        }).success( function( data ) {
            if( data.error ) {
		$scope.error_text = data.error
		$scope.flash_error();
	    } 
        });
    }

    $scope.show_error_bar = false;
    $scope.flash_error = function( newValue) {
	$scope.show_error_bar = true;
	$timeout( function() {
	    $scope.show_error_bar = false;
	},2000 )
    };
   
    $scope.resetPassword = function() {
	token = $location.absUrl().split('/')[5]
	$http({
	    method: 'POST',
            data: { 'from-reset-password-page': true,
		    'password': $scope.password
		  } ,
	    url:"/reset/"+token
	})
    }

    $scope.resetPasswordLoggedIn = function() {
	$http({
	    method: 'POST',
            data: {
		    'password': $scope.password
		  },
	    url:"/api/reset-password-logged-in"
	}).success( function(){
	    $scope.pwReset = true; 
        });
    }

    $scope.loggedIn = false;
    
    $scope.login = function() {
        var data = {}
        data.email = $scope.email;
        data.password = $scope.password;
        $http({ 
            method: 'POST',
	    url:"/api/login",
            data: $.param(data),
            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        }).success( function( data ) {
	    $scope.loggedIn = true;
	    $rootScope.userData = data
	    if ( $rootScope.isFirstLogin ) {
		$rootScope.authTwitter();
	    } else {
		$location.path("/dashboard");
	    }
        }).error( function( data ) {
	    $scope.error_text = "wrong email or password" 
	})
    }
}])

aa.controller('DashboardCtrl', ['$scope', 'searchTwitterFactory', '$http', '$location','$window', 'twitter', '$rootScope', '$timeout', function ($scope, searchTwitterFactory, $http, $location, $window, twitter, $rootScope, $timeout ) {

    $scope.saveCustomer = function(status, response) {
	$http.post('/api/stripe/createCustomer', { token: response.id }).success( 
	    function( data ) {
		$scope.userData.card_brand = data.cards.data[0].last4;
		$scope.userData.card_brand = data.cards.data[0].brand;
		$scope.userData.subscribed = true;
		$scope.showUpdateCard = false;
                $scope.showSubscribeFirstTime = false;
                $scope.subscribedSuccess = true;
	    });
    };
    $scope.updateCard = function(status, response) {
	$http.post('/api/stripe/updateCard', { token: response.id }).success( 
	    function( data ) {
		$scope.userData.card_last4 = data.cards.data[0].last4;
		$scope.userData.card_brand = data.cards.data[0].brand;
		$scope.userData.subscribed = true;
		$scope.showUpdateCard = false;
                $scope.updatedCardSuccess = true;
	    });
    };

    $scope.resetData = function() {
	$scope.conversations = []
	$scope.posts = []
    }


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
	    if ( typeof( data ) == "string" ) { // tweepy error hack
		$('#myModal').modal('show');
		$('.nav-tabs .auth-twitter').tab('show')
		$scope.settingsModalError = "something went wrong retrieving your information from Twitter. Please reauthorize your Twitter account.";
	    } else {
		$scope.posts = data;
		$scope.twitterUser = data[0].user
	    }
	});
        $scope.refreshTimeline = false;
    }

    $scope.init = function() {
	$http({ 
            method: 'POST',
	    url:"/api/getUserData",
        }).success( function( data, status ) {
	    $rootScope.userData = data

	    if ( location.hash.split('?').length > 1 ) {
		$scope.queryParams = _.object(_.compact(_.map(location.hash.split('?')[1].split('&'), function(item) {  if (item) return item.split('='); })));
	    }
	    
	    if( !$rootScope.userData.subscribed ) {
		$rootScope.userData.subscribed = false;
	    }
	    if ( $rootScope.userData.locked ) {
		$('#myModal').modal('show');
		$('.nav-tabs .payments-link').tab('show')
		$('li[role="presentation"]' ).addClass( "disabled" )
	    }
	    if ( !$.isEmptyObject( $scope.queryParams ) ) {
		$('#myModal').modal('show');
		$('.nav-tabs .auth-twitter').tab('show')
		$scope.settingsModalError = "this twitter handle is already registered to another user";
	    }
	    else {
		$scope.showResponseInput = false;
		$scope.count = 140;
		$scope.resetData();
		$scope.getPosts();
		$scope.getConvos();
		//$scope.getStripeCustomerInfo();
	    }
        })

    }
    
    $scope.twitterAuthed = false;

/*
    $scope.getStripeCustomerInfo = function() {
	$http({
	    method: 'GET',
	    url: "/api/stripe/getCustomerInfo"
	}).success( function( data ) {
	    if (data.data) {
		$scope.stripeCustomerInfo = data.data
		console.log( 'stripe customer info' )
	    }
	});
    }
*/
    $scope.cancelCustomerSubscription = function() {
	$http({
	    method: 'GET',
	    url: "/api/stripe/cancelSubscription"
	}).success( function( data ) {
	    $scope.userData.subscribed = false;
	    $scope.init();
	    $scope.conversations = []
	    $scope.posts = [];
            $scope.cancelledSuccess = true;
	});
    }


    $scope.subscribeCustomer = function() {
	$http({
	    method: 'GET',
	    url: "/api/stripe/subscribeCustomer"
	}).success( function( data ) {
	    $scope.userData.subscribed = true;
	    $scope.showUpdateCard = false;
	    $scope.showUpdateCard = false;
	    $scope.init();
            $scope.subscribedSuccess = true;
	});
    }

    $scope.init();
    
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


aa.service( 'twitter', function( $http ){
    return function( id_str ) {
	return $http( options )
    }
});


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
	    })
	    scope.$watch( 'showControls', function( newValue ) {
		elem.find( ".col-body").height( '100%')
		if ( newValue == true ){
		    var controlsHeight = elem.find(".col-controls").height()
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

aa.directive('pwCheck', [function () {
    return {
      require: 'ngModel',
      link: function (scope, elem, attrs, ctrl) {
        var firstPassword = '#' + attrs.pwCheck;
        elem.add(firstPassword).on('keyup', function () {
          scope.$apply(function () {
            var v = elem.val()===$(firstPassword).val();
            ctrl.$setValidity('pwmatch', v);
          });
        });
      }
    }
}])


aa.directive('payments', [function () {
    return {
      require: 'ngModel',
      link: function (scope, elem, attrs, ctrl) {
        var firstPassword = '#' + attrs.pwCheck;
        elem.add(firstPassword).on('keyup', function () {
          scope.$apply(function () {
            var v = elem.val()===$(firstPassword).val();
            ctrl.$setValidity('pwmatch', v);
          });
        });
      }
    }
}])

aa.directive('paymentsTable', [ '$compile', function ($compile) {
    return {
        link: function (scope, elem, attrs, ctrl) {
	    scope.userMap = function() {
	        var userData = scope.userData;
                if ( !userData ) {
                    return "aa";
                }
                else if ( userData.subscribed==false && userData.days_left_in_free_trial == 0 && !userData.card_last4 ) {
                    return "never_subscribed"
                }
                else if ( userData.subscribed==false && userData.days_left_in_free_trial == 0 && userData.card_last4 ) {
                    return "canceled"
                }
                else if ( userData.subscribed==true && userData.days_left_in_free_trial == 0 && userData.card_last4 ) {
                    return "subscribed"
                }
                else if ( userData.subscribed==false && userData.days_left_in_free_trial > 0 && userData.card_last4 ) {
                    return "free_trial_subscribe_but_canceled"
                }
                else if ( userData.subscribed==true && userData.days_left_in_free_trial > 0 && userData.card_last4 ) {
                    return "free_trial_subscribed"
                }
                else if ( userData.subscribed==false && userData.days_left_in_free_trial > 0 && !userData.card_last4 ) {
                    return "free_trial"
                } else {
                    return "blah"
                }
	    }
	    
	    var getUserTableCells = function ( userType ) {
		var userTableCells = {};
		if (  userType == "free_trial" ) {
                    userTableCells.statusText = "Free Trial <p>( {{userData.days_left_in_free_trial}} days left )</p>";
		    userTableCells.statusAction = '<span ng-init="showSubscribeFirstTime = false" ng-click="showSubscribeFirstTime = true"><a>subscribe</a></span>';
		    userTableCells.cardText = 'N/A';
		    userTableCells.cardAction = '';
		} 
		else if ( userType == "free_trial_subscribe_but_canceled" ) {
                    userTableCells.statusText = "Free Trial <p>( {{userData.days_left_in_free_trial}} days left )</p>";
		    userTableCells.statusAction = '<span ng-click="subscribeCustomer()"><a>re-subscribe</a></span>';
		    userTableCells.cardText = 'N/A';
		    userTableCells.cardAction = '<span ng-init="showUpdateCard = false" ng-click="showUpdateCard = !showUpdateCard"><a>update card</a></span>';
		} 		
		else if ( $.inArray( userType, [ 'free_tral_subscribed', 'subscribed' ] ) ) {
		    userTableCells.statusText = 'subscribed';
		    userTableCells.statusAction = '';
		    userTableCells.cardText = '{{ userData.card_last4 }}';
		    userTableCells.cardAction ='<span ng-init="showUpdateCard = false" ng-click="showUpdateCard = !showUpdateCard"><a>update card</a></div>';
		}
		else if ( $.inArray( userType, [ 'canceled' ] ) ) {
		    userTableCells.statusText = 'subscription canceled';
		    userTableCells.statusAction = '<span ng-click="subscribeCustomer()"><a>re-subscribe</a></span>';
		    userTableCells.cardText = 'N/A';
		    userTableCells.cardAction ='<span ng-init="showUpdateCard = false" ng-click="showUpdateCard = !showUpdateCard"><a>resubscribe with new card</a></div>';
		}
		else if ( $.inArray( userType, [ 'never_subscribed' ] ) ) {
		    userTableCells.statusText = "Your free trial has expired . Please subscribe to continue using cnkt";
		    userTableCells.statusAction = '<span ng-init="showSubscribeFirstTime = false" ng-click="showSubscribeFirstTime = true"><a>subscribe</a></span>';
		    userTableCells.cardText = 'N/A';
		    userTableCells.cardAction = '';
		}
		return userTableCells;
	    }
	    
	    scope.$watch( 'userData', function() {
		var userType = scope.userMap();
		var userTableCells = getUserTableCells( userType );
		for ( var key in userTableCells ) {
		    var aa = elem.find( "." + key);
		    aa.html( userTableCells[key] );
		    $compile(aa.contents())(scope);
		}
	
	    })
        }
    };				
}])


aa.config(function() {
  Stripe.setPublishableKey('pk_test_IN2jd8C7BtBsoH7F4589mFyH');
})



