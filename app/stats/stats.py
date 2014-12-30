#### DATA VISUALIZATION. TODO: MOVE THIS #######

#BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAAI0xWwAAAAAAh%2BD1hYDRl4VPTQbpDgf68WAn2Ao%3DXf6RD1CSilQbCQufOD0Cn3NsBgfRHcBkMgA0Kdr4ClN29Jfrge"

#CLASSIFIER = openClassifier()


#@app.route('/')
#def visualization():
#    return make_response( render_template( 'viz.html' ) )

#def getSentTimeseries( rawTwitterData ):
#    res = json.loads( rawTwitterData )
#    res = res["statuses"]
#    tweetSentimentTimeseries = []
#    for item in res:
#        aa = {}
#        aa["pos"] = getRating( item["text"], CLASSIFIER );
#        aa["created_at"] = item["created_at"]
#        aa["text"] = item["text"]
#        tweetSentimentTimeseries.append( aa )
#    tweetSentimentTimeseries = json.dumps( tweetSentimentTimeseries )
#    return tweetSentimentTimeseries

#def getPieChartData( rawTwitterData ):
#    res = json.loads( rawTwitterData )
#    res = res["statuses"]
#    aa = {}
#    aa["pos"] = 0
#    aa["neg"] = 0
#    for item in res:
#        sent = getRating( item["text"], CLASSIFIER )
#        if sent > .5:
#            aa["pos"] += 1
#        else:
#            aa["neg"] +=1
#    tweetSentimentTimeseries = []
#    for item in res:
#        cc = {}
#        cc["created_at"] = item["created_at"]
#        cc["text"] = item["text"]
#        cc["location"] = item["user"]["location"]
#        cc["place"] = item["place"]
#        cc["pos"] = getRating( item["text"], CLASSIFIER )
#        tweetSentimentTimeseries.append( cc )

#    bb = []
#    bb.append( { "key": "pos", "y" : aa["pos"] } )
#    bb.append( { "key": "neg", "y" : aa["neg"] } ) 
#    bb.append( tweetSentimentTimeseries )
#    pieChartData = json.dumps( bb )
#    return pieChartData


#@app.route('/api/company-info', methods = ['GET'])
#def searchCompanyName():
#    search_term = request.args.get('search_term')
#    search_term = str( search_term+ " -RT" )
#    search_term = urllib.quote_plus( search_term )
#    geocode = request.args.get('geocode')
#    geocode = str( geocode )
#    geocode = urllib.quote_plus( geocode )
    
#    posts = searchTwitterPosts( search_term, geocode )  

   # sentiment = getSentTimeseries( posts )
 #   sentiment = getPieChartData( posts )
 #   return sentiment
