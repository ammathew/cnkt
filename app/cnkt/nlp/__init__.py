@app.route("/api/extractEnts", methods=['GET', 'POST'] )
def extract_entities():
    req = request.get_json()
    text = req['text']
    entities = []
    for sent in nltk.sent_tokenize(text):
        for chunk in nltk.ne_chunk(nltk.pos_tag(nltk.word_tokenize(sent))):
            if hasattr(chunk, 'node'):
                for c in chunk.leaves():
                    entities.append( c[0] )
    data = json.dumps( entities )
    return data
