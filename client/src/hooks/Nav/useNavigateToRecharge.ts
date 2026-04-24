import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Dispatch, SetStateAction } from 'react';

type UseNavigateToRechargeOptions = {
  setNavVisible?: Dispatch<SetStateAction<boolean>>;
};

export default function useNavigateToRecharge({
  setNavVisible,
}: UseNavigateToRechargeOptions = {}) {
  const navigate = useNavigate();

  return useCallback(() => {
    if (setNavVisible) {
      setNavVisible(false);
      localStorage.setItem('navVisible', JSON.stringify(false));
    }
    navigate('/recharge');
  }, [navigate, setNavVisible]);
}
