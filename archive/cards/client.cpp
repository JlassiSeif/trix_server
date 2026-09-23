#include <iostream>
#include <string>
#include <cstring>

#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <sstream>

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

    std::string message = "cbon";
    std::stringstream ss;
    while (true)
    {
        char buffer[1024];
        int bytes_received = recv(client_fd, buffer, sizeof(buffer), 0);

        if (bytes_received <= 0)
        {
            std::cerr << "Server disconnected\n";
            break;
        }
        ss.str("");
        ss << buffer;
        std::string incoming_message = ss.str();
        if (!incoming_message.compare("ekhtar"))
        {
            send(client_fd, message.c_str(), message.size(), 0);
        }
        else
        {
            std::cout << incoming_message << std::endl;
        }
    }

    close(client_fd);

    return 0;
}