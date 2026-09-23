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

const int MAX_CLIENTS = 4;

std::mutex mtx;
std::vector<int> client_fds;

void some_logic(const std::string &message)
{
    // Do your desired logic here with the received message
}

void handle_client(int client_fd)
{
    char buffer[1024];
    std::stringstream ss;

    while (true)
    {
        memset(buffer, 0, sizeof(buffer));

        int bytes_received = recv(client_fd, buffer, sizeof(buffer), 0);

        if (bytes_received <= 0)
        {
            std::cerr << "Client " << client_fd << " disconnected\n";
            break;
        }

        ss.str("");
        ss << "Received from client " << client_fd << ": " << buffer << std::endl;
        std::cout << ss.str();

        some_logic(buffer);

        std::string response = "Message received\n";
        send(client_fd, response.c_str(), response.size(), 0);

        {
            std::lock_guard<std::mutex> lock(mtx);
            for (auto &fd : client_fds)
            {
                send(fd, buffer, strlen(buffer), 0);
            }
        }
    }

    close(client_fd);

    {
        std::lock_guard<std::mutex> lock(mtx);
        client_fds.erase(std::remove(client_fds.begin(), client_fds.end(), client_fd), client_fds.end());
    }
}

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

    while (true)
    {
        sockaddr_in client_address{};
        socklen_t client_address_len = sizeof(client_address);

        int client_fd = accept(server_fd, (struct sockaddr *)&client_address, &client_address_len);

        if (client_fd < 0)
        {
            std::cerr << "Failed to accept client\n";
            continue;
        }

        {
            std::lock_guard<std::mutex> lock(mtx);

            if (client_fds.size() >= MAX_CLIENTS)
            {
                std::cerr << "Maximum number of clients reached\n";
                close(client_fd);
                continue;
            }

            client_fds.push_back(client_fd);

            std::stringstream ss;
            ss << "Client " << client_fd << " connected\n";
            std::cout << ss.str();

            send(client_fd, "Connection established\n", 23, 0);
        }
        std::thread t(handle_client, client_fd);
        t.detach();
    }

    close(server_fd);

    return 0;
}