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

#include "src/deck.hpp"
#include "src/logic.hpp"

const int MAX_CLIENTS = 4;

std::vector<int> client_fds;

int main()
{

    int server_fd = socket(AF_INET, SOCK_STREAM, 0);

    if (server_fd < 0)
    {
        std::cerr << "Failed to create socket\n";
        return 1;
    }

    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    std::cout << INADDR_ANY << std::endl;
    address.sin_port = htons(8080);

    if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0)
    {
        std::cerr << "Failed to bind to port\n";
        return 1;
    }

    if (listen(server_fd, MAX_CLIENTS) < 0)
    {
        std::cerr << "Failed to listen\n";
        return 1;
    }

    std::cout << "Server listening on port 8080...\n";

    while (client_fds.size() < 4)
    {
        sockaddr_in client_address{};
        socklen_t client_address_len = sizeof(client_address);

        int client_fd = accept(server_fd, (struct sockaddr *)&client_address, &client_address_len);

        if (client_fd < 0)
        {
            std::cerr << "Failed to accept client\n";
            // continue;
        }

        {

            if (client_fds.size() >= MAX_CLIENTS)
            {
                std::cerr << "Maximum number of clients reached\n";
                close(client_fd);
                // continue;
            }

            client_fds.push_back(client_fd);

            std::stringstream ss;
            ss << "Client " << client_fd << " connected\n";
            std::cout << ss.str();
        }
    }
    std::vector<std::string> names = {"lam3i", "bochra", "ldhaw", "klafez"};
    for (int i = 0; i < 4; ++i)
    {
        std::stringstream ss;
        ss.str("");
        ss << i;
        std::string index = ss.str();
        std::string messages = names[i] + "," + index;
        send(client_fds[i], messages.c_str(), strlen(messages.c_str()), 0);
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(1000));
    bool end_game = 0;
    int chosen = 0;
    char sent_buffer[1024];
    logic l = logic(client_fds);
    while (!end_game && (client_fds.size() == 4))
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
    std::this_thread::sleep_for(std::chrono::milliseconds(1000));
    close(server_fd);

    return 0;
}