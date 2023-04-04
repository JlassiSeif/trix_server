#ifndef LOGIC_HPP_
#define LOGIC_HPP_

#include <iostream>
#include <string>
#include <cstring>
#include <sstream>
#include <vector>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include "deck.hpp"
#include <thread>
#include <map>
enum states
{
    PICK_GAME,
    MANCHE,
    CALCEL_SCORE,
    RESET_HANDS
};

class logic
{
public:
    int state = states::RESET_HANDS;
    int jarya = 1;
    std::vector<int> client_fds;
    std::vector<std::string> played_cards;
    std::vector<std::string> mekla_taa_kol_wehed[4];
    int scores[4] = {0, 0, 0, 0};
    int chosen_fil_games = 0;
    int chosen_fil_pli = 0;
    deck m_deck;
    logic(std::vector<int> c_client_fds);
    void pick_game();
    void reset_hand();
    void manche();
    void declare_winner();
    bool step();
    bool pli();
    int get_score(int index);
    std::string chosen_game = "";
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
    case (states::RESET_HANDS):
        reset_hand();
        state = states::PICK_GAME;
        break;

    case (states::PICK_GAME):
        pick_game();
        state = states::MANCHE;
        break;

    case (states::MANCHE):
        manche();
        state = states::CALCEL_SCORE;
        chosen_fil_games = (chosen_fil_games + 1) % 4;
        break;
    case (states::CALCEL_SCORE):
        declare_winner();
        jarya++;
        state = states::RESET_HANDS;
        for (int i = 0; i < 4; ++i)
        {
            if (scores[i] > 1000)
                return 1;
        }
        break;
    }
    return 0;
}
void logic::reset_hand()
{
    m_deck.Shuffle();
    std::string mess = "new_hand,";
    for (int i = 0; i < 4; ++i)
    {
        std::string h = mess + m_deck.get_hand(i);
        send(client_fds[i], h.c_str(), h.size(), 0);
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
}
void logic::manche()
{
    chosen_fil_pli = chosen_fil_games;
    for (int i = 0; i < 8; ++i)
    {
        if (pli())
            break;
    }
}
void logic::pick_game()
{
    std::string message = "";
    std::string message2 = "";
    std::stringstream ss;
    for (int i = 0; i < 4; ++i)
    {
        if (i == chosen_fil_games)
        {
            message = "ekhtar";
        }
        else
        {
            message = "stanna";
        }
        send(client_fds[i], message.c_str(), strlen(message.c_str()), 0);
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    char buffer[1024] = {""};
    int bytes_received = recv(client_fds[chosen_fil_games], buffer, sizeof(buffer), 0);
    if (bytes_received <= 0)
    {
        std::cerr << "Client " << client_fds[chosen_fil_games] << " disconnected\n";
    }
    chosen_game = std::string(buffer);
    std::string l = "game," + chosen_game;
    for (int i = 0; i < 4; ++i)
    {
        send(client_fds[i], l.c_str(), strlen(l.c_str()), 0);
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
}

bool logic::pli()
{
    bool FIRST_CARD = 1;
    for (int i = chosen_fil_pli; i < chosen_fil_pli + 4; ++i)
    {
        int index = i % 4;
        int hala = 0;
        for (int j = index; j < index + 4; ++j)
        {
            int client_index = j % 4;
            if (j == index)
            {
                std::string mes = "";
                mes = "your_turn";
                send(client_fds[client_index], mes.c_str(), strlen(mes.c_str()), 0);
            }
            else
            {
                std::stringstream ss;
                ss.str("");
                ss << hala;
                std::string mes = "";
                std::string rata = ss.str();
                mes = "turn," + rata;
                send(client_fds[client_index], mes.c_str(), strlen(mes.c_str()), 0);
                ++hala;
            }
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(100));

        char buffer[1024] = {""};
        int bytes_received = recv(client_fds[index], buffer, sizeof(buffer), 0);

        std::string played = std::string(buffer);
        if (FIRST_CARD)
        {
            for (int i = 0; i < 4; ++i)
            {
                std::string rata = "strong_suit," + played;
                send(client_fds[i], rata.c_str(), strlen(rata.c_str()), 0);
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            FIRST_CARD = 0;
        }
        played_cards.push_back(played);
        std::stringstream ss;
        int j = 0;
        for (int k = index + 1; k < index + 4; ++k)
        {
            int client_index = k % 4;
            ss.str("");
            ss << j;
            std::string rata = "car_played," + ss.str() + "," + played;
            send(client_fds[client_index], rata.c_str(), strlen(rata.c_str()), 0);
            ++j;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    chosen_fil_pli = (chosen_fil_pli + m_deck.decide_mekla(played_cards)) % 4;
    for (auto el : played_cards)
    {
        mekla_taa_kol_wehed[chosen_fil_pli].push_back(el);
    }
    std::string rata = "end_of_pli";
    if (chosen_game == "ray")
    {
        for (auto el : played_cards)
        {
            if (el == "k_h")
            {
                return 1;
            }
        }
    }
    for (int i = 0; i < 4; i++)
    {
        send(client_fds[i], rata.c_str(), strlen(rata.c_str()), 0);
    }
    played_cards.clear();
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    return 0;
}
int calculate_score(std::vector<card> &cards, const std::string &game_type, bool cond)
{
    int score = 0;

    if (game_type == "dineri")
    {
        for (const auto &card : cards)
        {
            if (card.c_suit == Suit::DIAMONDS)
            {
                score += 10;
            }
        }
    }
    else if (game_type == "damet")
    {
        for (const auto &card : cards)
        {
            if (card.c_rank == Rank::QUEEN)
            {
                score += 20;
            }
        }
    }
    else if (game_type == "ray")
    {
        for (const auto &card : cards)
        {
            if (card.c_rank == Rank::KING && card.c_suit == Suit::HEARTS)
            {
                score += 100;
            }
        }
    }
    else if (game_type == "pli")
    {
        int num_cards = cards.size();
        if (num_cards >= 4)
        {
            int num_plis = num_cards / 4;
            score = num_plis * 10;
        }
    }
    else if (game_type == "Farcha")
    {
        if (cond)
        {
            score = 100;
        }
    }
    else if (game_type == "trix")
    {
        if (cond)
        {
            score = 100;
        }
    }
    return score;
}

int logic::get_score(int index)
{
    std::string game_type = chosen_game;
    std::vector<std::string> cards_str = mekla_taa_kol_wehed[index];
    std::vector<card> cards = m_deck.string_to_cards(cards_str);
    int score = 0;

    if (game_type == "dineri")
    {
        for (const auto &card : cards)
        {
            if (card.c_suit == Suit::DIAMONDS)
            {
                score += 10;
            }
        }
    }
    else if (game_type == "damet")
    {
        for (const auto &card : cards)
        {
            if (card.c_rank == Rank::QUEEN)
            {
                score += 20;
            }
        }
    }
    else if (game_type == "ray")
    {
        for (const auto &card : cards)
        {
            if (card.c_rank == Rank::KING && card.c_suit == Suit::HEARTS)
            {
                score += 100;
            }
        }
    }
    else if (game_type == "pli")
    {
        int num_cards = cards.size();
        if (num_cards >= 4)
        {
            int num_plis = num_cards / 4;
            score = num_plis * 10;
        }
    }
    else if (game_type == "farcha")
    {
        if (index == chosen_fil_pli)
        {
            score = 100;
        }
    }
    else if (game_type == "general")
    {
        // Calculate scores for all game types
        score += calculate_score(cards, "dineri", (index == chosen_fil_pli));
        score += calculate_score(cards, "damet", (index == chosen_fil_pli));
        score += calculate_score(cards, "ray", (index == chosen_fil_pli));
        score += calculate_score(cards, "pli", (index == chosen_fil_pli));
        score += calculate_score(cards, "farcha", (index == chosen_fil_pli));
    }

    return score;
}
void logic::declare_winner()
{
    std::vector<std::string> names = {"lam3i", "bochra", "ldhaw", "klafez"};
    std::cout << "jarya nummer: " << jarya << std::endl;
    for (int i = 0; i < 4; ++i)
    {
        scores[i] += get_score(i);
        std::cout << names[i] << "   " << scores[i] << std::endl;
    }
}

#endif
