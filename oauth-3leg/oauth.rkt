#lang racket

(require sha
         net/uri-codec)

(provide make-token oauth)
  
(define make-token cons)
(define token-key car)
(define token-secret cdr)

; uri-unreserved-encode will also encode !*'()

(define ascii-zero (char->integer #\0))

(define (get-timestamp)
  (number->string (current-seconds)))

(define (oauth consumer
               #:nonce-length [nonce-length 32]
               #:version [version "1.0"]
               #:parameter-separator [parameter-separator ", "]
               #:realm [realm "Schoology API"]
               #:signature-method [signature-method "HMAC-SHA1"])
  (define (get-nonce)
    (list->string
     (build-list nonce-length
                 (lambda ()
                   (integer->char (+ ascii-zero (random 10)))))))

  (define (get-signature url method token-secret oauth-data)
    (let ((base-string
           (string-append
            method
            "&"
            (uri-unreserved-encode (car (string-split url "?")))
            "&"))
          (signing-key 'unimplemented))
      (hmac-sha1 (string->bytes/utf-8 signing-key)
                 (string->bytes/utf-8 base-string))))

  (define (authorize url [token #f] #:method [method "GET"])
    (define oauth-data
      (append (list (cons "realm" realm)
                    (cons "oauth_consumer_key" (token-key consumer))
                    (cons "oauth_nonce" (get-nonce))
                    (cons "oauth_signature_method" signature-method)
                    (cons "oauth_timestamp" (get-timestamp))
                    (cons "oauth_version" version))
              (if token
                  (cons "oauth_token" (token-key token))
                  '())))
    
    (string-append
     "OAuth"
     (string-join
      (map (lambda (entry)
             (let ((key (car entry))
                   (value (cdr entry)))
               (string-append
                (uri-unreserved-encode key)
                "=\""
                (uri-unreserved-encode value)
                "\"")))
           (cons (cons "oauth_signature"
                       (get-signature url
                                      method
                                      (token-secret token)
                                      oauth-data))
                 oauth-data))
      parameter-separator)))
                        

  'unimplemented)
