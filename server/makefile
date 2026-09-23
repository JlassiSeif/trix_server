CC = g++
CFLAGS = -std=c++11 -g

all: server

server: final.cpp
	$(CC) $(CFLAGS) $< -o $@

run: server
	./server

clean:
	rm -f server
