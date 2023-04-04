
#include "src/logic.hpp"

int main()
{
    std::vector<int> client_fds = {4, 5, 6, 7};
    logic l = logic(client_fds);

    l.reset_hand();

    return 0;
}