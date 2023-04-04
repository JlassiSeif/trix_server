#include <iostream>
#include <string>
#include <cstring>
#include <sstream>
#include <vector>
#include <algorithm>
#include <thread>
#include <mutex>

#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>

#include "src/deck.h"
#include "src/logic.h"

const int MAX_CLIENTS = 4;

int main()
{

    // }
    bool end_game = 0;
    int chosen = 0;
    char sent_buffer[1024];
    // logic l = logic();

    bool end_game = 0;
    int chosen = 0;
    char sent_buffer[1024];
    std::vector<int> client_fds = {4, 5, 6, 7};
    logic l = logic(client_fds);
    while (!end_game && (client_fds.size() == 1))
    {
        end_game = l.step();
    }

    for (auto i : client_fds)
    {
        std::stringstream ss;
        ss.str("disconnect");
        std::string str = ss.str();
        send(i, str.c_str(), strlen(str.c_str()), 0);
    }

    return 0;
}