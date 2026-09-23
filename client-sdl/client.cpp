#include <iostream>
#include <string>
#include <cstring>
#include <chrono>
#include <thread>

#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <fcntl.h>

#include "src/graphics.h"

int main()
{

    int client_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (client_fd < 0)
    {
        std::cerr << "Failed to create socket\n";
        return 1;
    }

    sockaddr_in server_address{};
    server_address.sin_family = AF_INET;
    server_address.sin_port = htons(8080);

    if (inet_pton(AF_INET, "127.0.0.1", &server_address.sin_addr) <= 0)
    {
        std::cerr << "Invalid address\n";
        return 1;
    }

    if (connect(client_fd, (struct sockaddr *)&server_address, sizeof(server_address)) < 0)
    {
        std::cerr << "Failed to connect to server\n";
        return 1;
    }
    char buffer[1024];
    int bytes_received = recv(client_fd, buffer, sizeof(buffer), 0);
    std::stringstream aa;
    aa.str("");
    aa << std::string(buffer, bytes_received);
    std::cout << aa.str() << std::endl;
    std::vector<std::string>
        p = splitString(aa.str(), ',');
    graphics game = graphics(client_fd, p[0], stoi(p[1]));
    game.render();

    // Set socket to non-blocking
    int flags = fcntl(client_fd, F_GETFL, 0);
    if (flags == -1)
    {
        std::cerr << "Failed to get socket flags\n";
        return 1;
    }
    if (fcntl(client_fd, F_SETFL, flags | O_NONBLOCK) == -1)
    {
        std::cerr << "Failed to set socket to non-blocking\n";
        return 1;
    }

    std::string message = "cbon";
    std::stringstream ss;
    bool end_game = 1;

    while (end_game)
    {
        // Receive data from the server
        char buffer[1024];
        int bytes_received = recv(client_fd, buffer, sizeof(buffer), 0);

        if (bytes_received < 0 && errno == EAGAIN)
        {
            // No data available, wait a bit
            // std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
        else if (bytes_received <= 0)
        {
            // Server disconnected or error occurred
            std::cerr << "Server disconnected\n";
            break;
        }
        else
        {
            ss.str("");
            ss << std::string(buffer, bytes_received);
            std::string incoming_message = ss.str();
            if (incoming_message == "disconnect")
            {
                goto end;
            }
            game.parse(incoming_message);
        }
        end_game = game.run();
        game.render();
        game.wait();
    }
end:
    game.close();
    close(client_fd);

    return 0;
}
