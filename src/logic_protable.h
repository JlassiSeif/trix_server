#pragma once

#ifndef LOGIC_H_
#define LOGIC_H_

#include <iostream>
#include <string>
#include <cstring>
#include <sstream>
#include <vector>

#ifdef _WIN32
#include <Windows.h>
#include <WinSock2.h>
#pragma comment(lib, "ws2_32.lib")
#else
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>
#endif

#include "deck.h"

enum states
{
    PICK_GAME,
    PLI,
    CALCEL_SCORE,
    RESET_HANDS
};

class logic
{
public:
    int state = states::PICK_GAME;
    std::vector<int> client_fds;
    int chosen = 0;
    deck m_deck;
    logic(std::vector<int> c_client_fds);
    void pick_game();
    void reset_hand();
    bool manche(std::vector<int>, int);
    void declare_winner();
    bool step();
};

logic::logic(std::vector<int> c_client_fds)
{
    client_fds = c_client_fds;
    m_deck = deck();
}

bool logic::step()
{
    switch (state)
    {
    case (states::PICK_GAME):
        pick_game();
        state = states::RESET_HANDS;
        break;
    case (states::RESET_HANDS):
        reset_hand();
        state = states::PLI;
        break;

    case (states::PLI):

        break;
    case (states::CALCEL_SCORE):

        break;
    }
    return 0;
}

void logic::pick_game()
{
    std::string message = "";
    std::string message2 = "";
    std::stringstream ss;
    for (int i = 0; i < 4; ++i)
    {
        if (i == chosen)
        {
            message = "ekhtar";
        }
        else
        {
            message = "stanna";
        }

#ifdef _WIN32
        send(client_fds[i], message.c_str(), strlen(message.c_str()), 0);
#else
        write(client_fds[i], message.c_str(), strlen(message.c_str()));
#endif
    }

    char buffer[1024] = {""};
#ifdef _WIN32
    int bytes_received = recv(client_fds[chosen], buffer, sizeof(buffer), 0);
#else
    int bytes_received = read(client_fds[chosen], buffer, sizeof(buffer));
#endif
    if (bytes_received <= 0)
    {
        std::cerr << "Client " << client_fds[chosen] << " disconnected\n";
    }

    for (int i = 0; i < 4; ++i)
    {
#ifdef _WIN32
        send(client_fds[i], buffer, strlen(buffer), 0);
#else
        write(client_fds[i], buffer, strlen(buffer));
#endif
    }
}
void logic::reset_hand()
{
    m_deck.Shuffle();
    std::string mess = "new_hand,";
    for (int i = 0; i < 4; ++i)
    {
        std::string h = mess + m_deck.get_hand(i);
        std::cout << h << std::endl;

#ifdef _WIN32
        send(client_fds[i], h.c_str(), h.size(), 0);
#else
        write(client_fds[i], h.c_str(), h.size());
#endif
    }
}

bool logic::manche(std::vector<int>, int)
{
    return 0;
}
void logic::declare_winner()
{
}

#endif