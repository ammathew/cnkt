import cPickle as pickle
import nltk

def openClassifier():
    f = open( 'sentimentClassifierCPickle', 'rb' )
    classifier = pickle.load( f )
    f.close()
    return classifier

def word_feats(words):
    return dict([(word, True) for word in words])

def getRating( tweet, classifier ):
    tokens = nltk.word_tokenize( tweet )
    return classifier.prob_classify(word_feats( tokens )).prob('pos')

