#lang racket

(require web-server/servlet
         web-server/servlet-env
         "oauth.rkt")

(define (start req)
  (response/xexpr
   `(html (head (title "Hello world!"))
          (body (p "Hey out there!")))))

(serve/servlet start
               #:launch-browser? #f
               #:servlet-path "/")
